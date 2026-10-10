import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { adminNotificationDetails, notifyAdmins } from '../../shared/adminNotifications.js';
import {
  PATIENT_REQUEST_CONTACT_RETENTION_DAYS,
  PATIENT_REQUEST_EXPIRY_DAYS,
  PATIENT_REQUEST_RETENTION_POLICY_KEY,
  PatientRequestValidationError,
  sanitizePatientRequestSubmission,
} from '../../shared/patientRequestPersistence.js';
import { notifyPatientRequestReceived } from '../../shared/patientCommunicationNotifications.js';
import {
  REQUEST_READY_POLICY_VERSION,
  TOP3_LIMIT,
  loadRequestReadiness,
  serverNeedLevel,
  stricterNeedLevel,
} from '../../shared/requestReadyRecommendation.js';
import {
  PATIENT_SEARCH_CONTACT_MODE,
  PATIENT_SEARCH_CONTACT_RETENTION_POLICY_KEY,
  PatientSearchContactValidationError,
  sanitizePatientSearchContact,
} from '../../shared/patientSearchContact.js';

const MAX_REQUESTS_PER_CONTACT_PER_HOUR = 5;
const IDEMPOTENCY_SETTLE_MS = 90;
const MAX_SEARCH_CONTACTS_PER_CONTACT_PER_HOUR = 10;
const SEARCH_CONTACT_WINDOW_MS = 2 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function randomToken(bytesLength = 24) {
  if (typeof crypto.randomUUID === 'function' && bytesLength <= 24) return crypto.randomUUID().replace(/-/g, '');
  const bytes = new Uint8Array(bytesLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicReference() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return `VS-${Array.from(bytes).map((byte) => (byte % 36).toString(36)).join('').toUpperCase()}`;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function phoneIdentity(value) {
  return String(value || '').replace(/\D/g, '');
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function optionalUser(base44) {
  try {
    return await base44.auth.me();
  } catch (_error) {
    return null;
  }
}

function oldestRequest(rows) {
  return [...(rows || [])].sort((left, right) => {
    const leftDate = String(left?.created_date || '');
    const rightDate = String(right?.created_date || '');
    const dateOrder = leftDate.localeCompare(rightDate);
    if (dateOrder !== 0) return dateOrder;
    return String(left?.id || '').localeCompare(String(right?.id || ''));
  })[0] || null;
}

function replayResponse(request, status = 200) {
  return Response.json({
    success: true,
    idempotent_replay: true,
    request_id: request.id,
    public_reference: request.public_reference || '',
    persistence_state: request.persistence_state || 'complete',
    status: request.status || 'salvata',
    contact_sharing_enabled: false,
  }, { status });
}

async function findExisting(svc, idempotencyKey) {
  const rows = await svc.entities.PatientRequest.filter({ idempotency_key: idempotencyKey }, 'created_date', 10);
  return oldestRequest(rows);
}

async function rollbackPartial(svc, requestId) {
  if (!requestId) return;
  await Promise.allSettled([
    svc.entities.PatientRequestContact.deleteMany({ request_id: requestId }),
    svc.entities.PatientRequestAnswer.deleteMany({ request_id: requestId }),
    svc.entities.RequestMatch.deleteMany({ request_id: requestId }),
  ]);
  try {
    await svc.entities.PatientRequest.delete(requestId);
  } catch (_error) {
    await svc.entities.PatientRequest.update(requestId, { persistence_state: 'partial_failure' }).catch(() => null);
  }
}

// 2026-09-27, cererea owner-ului: datele de contact lasate la fiecare cautare, inainte de
// rezultate (regulile: shared/patientSearchContact.js). Stau in aceeasi functie ca cererea, ca
// suprafata Base44 sa ramana la 49 de functii fizice. Nu creeaza o cerere, nu atinge potrivirea
// si nu trimite nimic locatiilor.
async function saveSearchContact(base44, svc, input) {
  const submission = sanitizePatientSearchContact(input);
  const user = await optionalUser(base44);
  const now = new Date();
  const nowIso = now.toISOString();
  const identitySource = submission.contact.contact_email
    ? `email:${submission.contact.contact_email}`
    : `phone:${phoneIdentity(submission.contact.contact_phone)}`;
  const contactIdentityHash = await sha256(identitySource);
  const recent = await svc.entities.PatientSearchContact.filter({
    contact_identity_hash: contactIdentityHash,
    created_date: { $gt: new Date(now.getTime() - SEARCH_CONTACT_WINDOW_MS).toISOString() },
  }, '-created_date', 50);

  const record = {
    ...submission.contact,
    ...submission.search,
    requester_user_id: user?.id || '',
    contact_identity_hash: contactIdentityHash,
    processing_consent: true,
    processing_consent_version: submission.consent.version,
    processing_consent_at: nowIso,
    // Acordul optional pentru noutati si oferte (2026-09-28). Salvarea din nou a aceleiasi
    // cautari pastreaza alegerea cea mai recenta.
    marketing_consent: submission.consent.marketing,
    marketing_consent_version: submission.consent.marketing_version,
    marketing_consent_at: submission.consent.marketing ? nowIso : null,
    // 2026-09-28, decizia owner-ului: fara stergere automata; datele raman pana la retragerea
    // acordului sau o cerere de stergere (vezi shared/patientSearchContact.js).
    retention_policy_key: PATIENT_SEARCH_CONTACT_RETENTION_POLICY_KEY,
    status: 'active',
  };
  if (record.age_years === null) delete record.age_years;

  // Aceeasi cautare trimisa din nou (ex. dupa "Modifica") actualizeaza inregistrarea existenta.
  const sameSearch = submission.search.search_key
    ? recent.find((row) => row.search_key === submission.search.search_key)
    : null;
  if (sameSearch) {
    await svc.entities.PatientSearchContact.update(sameSearch.id, record);
    return Response.json({ success: true, contact_id: sameSearch.id, updated: true });
  }

  const oneHourAgo = now.getTime() - 60 * 60 * 1000;
  const lastHour = recent.filter((row) => Date.parse(String(row?.created_date || '')) > oneHourAgo);
  if (lastHour.length >= MAX_SEARCH_CONTACTS_PER_CONTACT_PER_HOUR) {
    return Response.json({ error: 'Au fost trimise prea multe date într-un interval scurt. Încearcă mai târziu.' }, { status: 429 });
  }

  const created = await svc.entities.PatientSearchContact.create({ ...record, follow_up_status: 'nou' });
  // 2026-10-10: anunt pentru admin (clopotel + email), fara datele de contact. Nu blocheaza raspunsul.
  await notifyAdmins(svc, {
    event: 'search_contact_left',
    entityType: 'PatientSearchContact',
    entityId: created.id,
    details: adminNotificationDetails(submission.search?.intent_label, submission.search?.city, submission.search?.county),
  });
  return Response.json({ success: true, contact_id: created.id, updated: false }, { status: 201 });
}

// Cand aceeasi persoana salveaza apoi o cerere, legam datele lasate la cautare de cerere, ca
// echipa sa vada cine a continuat. Best effort: o eroare aici nu afecteaza cererea.
async function linkSearchContactToRequest(svc, contactIdentityHash, requestId, now) {
  const rows = await svc.entities.PatientSearchContact.filter({
    contact_identity_hash: contactIdentityHash,
    created_date: { $gt: new Date(now.getTime() - SEARCH_CONTACT_WINDOW_MS).toISOString() },
  }, '-created_date', 10);
  const target = (rows || []).find((row) => !row.linked_request_id);
  if (!target) return;
  await svc.entities.PatientSearchContact.update(target.id, {
    linked_request_id: requestId,
    linked_request_at: now.toISOString(),
  });
}

async function validatePublishedMatches(svc, matches) {
  const resolved = await Promise.all((matches || []).map(async (match) => {
    const location = await svc.entities.ProviderLocation.get(match.location_id).catch(() => null);
    if (!location) return null;
    if (location.status !== 'publicata' || location.is_active === false || location.profile_control_status === 'suspended') return null;
    return { match, location };
  }));
  return resolved.filter(Boolean);
}

function withReason(match, reason) {
  return [...new Set([...(Array.isArray(match.exclusion_reasons) ? match.exclusion_reasons : []), reason])].slice(0, 20);
}

// 2026-10-09 (audit Top 3, T5; Alex: „Începe”). Clasamentul vine din browser, deci serverul îl
// verifică înainte să-l salveze (detaliile complete merg doar la Top 3):
//  - cel mult TOP3_LIMIT locații rămân „top3”, în ordinea primită;
//  - fiecare „top3” trebuie să poată primi cererea (aceeași regulă ca la căutare și la trimitere);
//  - „top3” / „extended_confirmed” cer profil revendicat sau verificat (verificat la nevoi medicale
//    specializate), cu nivelul nevoii calculat pe server;
//  - ce nu trece coboară o treaptă și rămâne notat în `exclusion_reasons`.
// Ordinea și scorurile primite nu se schimbă.
async function validateRecommendationBuckets(svc, resolved, request) {
  const needLevel = request.matching_need_level || '';
  // Toate cele marcate „top3” (cel mult 20, cât acceptă normalizeMatches); rămân primele TOP3_LIMIT valide.
  const top3Candidates = resolved.filter(({ match }) => match.result_bucket === 'top3');
  const servicesByLocation = new Map(await Promise.all(top3Candidates.map(async ({ location }) => [
    location.id,
    await svc.entities.LocationService.filter({ location_id: location.id }, null, 500).catch(() => []),
  ])));
  const readiness = await loadRequestReadiness(svc, top3Candidates.map(({ location }) => ({
    location,
    services: servicesByLocation.get(location.id) || [],
    requestedKeys: request.service_keys || [],
  })), needLevel);

  let top3Count = 0;
  return resolved.map(({ match, location }) => {
    let bucket = match.result_bucket;
    let reasons = Array.isArray(match.exclusion_reasons) ? match.exclusion_reasons : [];
    const control = String(location.profile_control_status || '');
    if (bucket === 'top3' || bucket === 'extended_confirmed') {
      const controlled = ['claimed', 'verified'].includes(control)
        && (needLevel !== 'specialized_medical' || control === 'verified');
      if (!controlled) {
        // Ca la potrivire (recommendationBucketForProfile): profilul nepotrivit nivelului coboară la
        // rezultat suplimentar din director.
        bucket = 'extended_directory';
        reasons = withReason({ exclusion_reasons: reasons }, 'server_validation:profile_not_eligible');
      }
    }
    if (bucket === 'top3') {
      const check = readiness.get(location.id);
      if (top3Count >= TOP3_LIMIT) {
        bucket = 'extended_confirmed';
        reasons = withReason({ exclusion_reasons: reasons }, 'server_validation:top3_limit');
      } else if (!check?.ready) {
        bucket = 'extended_confirmed';
        reasons = withReason({ exclusion_reasons: reasons }, `server_validation:not_request_ready:${(check?.reasons || ['unknown']).join(',')}`);
      } else {
        top3Count += 1;
      }
    }
    return {
      ...match,
      result_bucket: bucket,
      bucket_rank: bucket === 'top3' ? top3Count : match.bucket_rank,
      is_top3_eligible: bucket === 'top3',
      need_level_snapshot: needLevel || match.need_level_snapshot || null,
      snapshot_source: 'client_confirmed_search_server_validated',
      recommendation_contract_version: `${match.recommendation_contract_version || ''}|${REQUEST_READY_POLICY_VERSION}`.slice(0, 100),
      exclusion_reasons: reasons,
    };
  });
}

Deno.serve(async (request) => {
  let createdRequestId = '';
  try {
    const base44 = createClientFromRequest(request);
    const svc = base44.asServiceRole;
    const input = await request.json().catch(() => ({}));
    if (input?.mode === PATIENT_SEARCH_CONTACT_MODE) return await saveSearchContact(base44, svc, input);
    const submission = sanitizePatientRequestSubmission(input);
    // 2026-10-09 (audit Top 3, T5): nivelul nevoii nu mai vine doar din browser. Se păstrează cel mai
    // strict dintre cel calculat pe server din serviciile cererii și cel primit.
    submission.request.matching_need_level = stricterNeedLevel(
      serverNeedLevel(submission.request.service_keys),
      submission.request.matching_need_level,
    ) || submission.request.matching_need_level || '';
    const user = await optionalUser(base44);
    const now = new Date();
    const nowIso = now.toISOString();

    const existing = await findExisting(svc, submission.idempotency_key);
    if (existing && existing.persistence_state !== 'partial_failure') return replayResponse(existing);
    if (existing?.persistence_state === 'partial_failure') await rollbackPartial(svc, existing.id);

    const geographyRows = await svc.entities.GeographicLocality.filter({
      siruta_code: submission.request.locality_siruta_code,
      is_active: true,
    }, null, 2);
    const geography = geographyRows[0];
    if (!geography) {
      return Response.json({ error: 'Localitatea selectata nu mai este disponibila.', field: 'request_draft.locality_siruta_code' }, { status: 400 });
    }

    const contactEmailHash = submission.contact.contact_email
      ? await sha256(submission.contact.contact_email)
      : '';
    const identitySource = submission.contact.contact_email
      ? `email:${submission.contact.contact_email}`
      : `phone:${phoneIdentity(submission.contact.contact_phone)}`;
    const contactIdentityHash = await sha256(identitySource);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const recent = await svc.entities.PatientRequest.filter({
      contact_identity_hash: contactIdentityHash,
      created_date: { $gt: oneHourAgo },
    }, '-created_date', 10);
    if (recent.length >= MAX_REQUESTS_PER_CONTACT_PER_HOUR) {
      return Response.json({ error: 'Au fost create prea multe cereri intr-un interval scurt. Incearca mai tarziu.' }, { status: 429 });
    }

    const accessToken = randomToken(32);
    const requestRecord = await svc.entities.PatientRequest.create({
      ...submission.request,
      city: geography.name || submission.request.city,
      county: geography.county_name || submission.request.county || '',
      locality_siruta_code: geography.siruta_code,
      requester_user_id: user?.id || '',
      contact_email_hash: contactEmailHash,
      contact_identity_hash: contactIdentityHash,
      idempotency_key: submission.idempotency_key,
      public_reference: publicReference(),
      submitted_at: nowIso,
      expires_at: addDays(now, PATIENT_REQUEST_EXPIRY_DAYS),
      persistence_state: 'creating',
      status: 'salvata',
    });
    createdRequestId = requestRecord.id;

    await sleep(IDEMPOTENCY_SETTLE_MS);
    const winner = await findExisting(svc, submission.idempotency_key);
    if (winner && winner.id !== requestRecord.id) {
      await rollbackPartial(svc, requestRecord.id);
      return replayResponse(winner, winner.persistence_state === 'complete' ? 200 : 202);
    }

    const normalizedUserEmail = String(user?.email || '').trim().toLowerCase();
    const emailVerified = Boolean(
      submission.contact.contact_email
      && normalizedUserEmail
      && normalizedUserEmail === submission.contact.contact_email,
    );
    const contactRecord = await svc.entities.PatientRequestContact.create({
      request_id: requestRecord.id,
      requester_user_id: user?.id || '',
      ...submission.contact,
      provider_contact_sharing_consent: false,
      processing_consent_at: nowIso,
      contact_email_verified: emailVerified,
      contact_email_verified_at: emailVerified ? nowIso : null,
      access_token_hash: await sha256(accessToken),
      retention_policy_key: PATIENT_REQUEST_RETENTION_POLICY_KEY,
      retention_until: addDays(now, PATIENT_REQUEST_CONTACT_RETENTION_DAYS),
      status: 'active',
    });

    if (submission.answers.length > 0) {
      await svc.entities.PatientRequestAnswer.bulkCreate(
        submission.answers.map((answer) => ({ request_id: requestRecord.id, ...answer })),
      );
    }

    const validMatches = await validateRecommendationBuckets(
      svc,
      await validatePublishedMatches(svc, submission.matches),
      submission.request,
    );
    if (validMatches.length > 0) {
      await svc.entities.RequestMatch.bulkCreate(
        validMatches.map((match) => ({ request_id: requestRecord.id, ...match })),
      );
    }

    const completedRequest = await svc.entities.PatientRequest.update(requestRecord.id, {
      contact_record_id: contactRecord.id,
      match_count: validMatches.length,
      top3_count: validMatches.filter((match) => match.result_bucket === 'top3').length,
      persistence_state: 'complete',
    });

    const finalWinner = await findExisting(svc, submission.idempotency_key);
    if (finalWinner && finalWinner.id !== requestRecord.id) {
      await rollbackPartial(svc, requestRecord.id);
      return replayResponse(finalWinner, finalWinner.persistence_state === 'complete' ? 200 : 202);
    }

    await linkSearchContactToRequest(svc, contactIdentityHash, requestRecord.id, now).catch(() => null);

    await notifyPatientRequestReceived({
      base44,
      svc,
      request: completedRequest || requestRecord,
      contact: contactRecord,
    }).catch(() => null);

    // 2026-10-10: anunt pentru admin (clopotel + email), fara datele pacientului si fara textul cererii.
    await notifyAdmins(base44, {
      event: 'patient_request_saved',
      entityType: 'PatientRequest',
      entityId: requestRecord.id,
      details: adminNotificationDetails(
        requestRecord.public_reference,
        requestRecord.city,
        requestRecord.county,
        `${validMatches.length} ${validMatches.length === 1 ? 'potrivire' : 'potriviri'}`,
      ),
    });

    return Response.json({
      success: true,
      idempotent_replay: false,
      request_id: requestRecord.id,
      public_reference: requestRecord.public_reference,
      persistence_state: 'complete',
      status: 'salvata',
      request_access_token: accessToken,
      match_count: validMatches.length,
      top3_count: validMatches.filter((match) => match.result_bucket === 'top3').length,
      contact_sharing_enabled: false,
      message: 'Cererea a fost salvata. Telefonul nu a fost transmis niciunui furnizor.',
    }, { status: 201 });
  } catch (error) {
    if (createdRequestId) {
      try {
        const base44 = createClientFromRequest(request);
        await rollbackPartial(base44.asServiceRole, createdRequestId);
      } catch (_rollbackError) {
        // The partial marker is handled inside rollbackPartial whenever possible.
      }
    }
    if (error instanceof PatientRequestValidationError || error instanceof PatientSearchContactValidationError) {
      return Response.json({ error: error.message, field: error.field || '' }, { status: 400 });
    }
    return Response.json({ error: 'Cererea nu a putut fi salvata.' }, { status: 500 });
  }
});
