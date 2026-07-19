import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PATIENT_REQUEST_CONTACT_RETENTION_DAYS,
  PATIENT_REQUEST_EXPIRY_DAYS,
  PATIENT_REQUEST_RETENTION_POLICY_KEY,
  PatientRequestValidationError,
  sanitizePatientRequestSubmission,
} from '../../../shared/patientRequestPersistence.js';

const MAX_REQUESTS_PER_EMAIL_PER_HOUR = 5;
const IDEMPOTENCY_SETTLE_MS = 90;

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

async function validatePublishedMatches(svc, matches) {
  const resolved = await Promise.all((matches || []).map(async (match) => {
    const location = await svc.entities.ProviderLocation.get(match.location_id).catch(() => null);
    if (!location) return null;
    if (location.status !== 'publicata' || location.is_active === false || location.profile_control_status === 'suspended') return null;
    return match;
  }));
  return resolved.filter(Boolean);
}

Deno.serve(async (request) => {
  let createdRequestId = '';
  try {
    const base44 = createClientFromRequest(request);
    const svc = base44.asServiceRole;
    const input = await request.json().catch(() => ({}));
    const submission = sanitizePatientRequestSubmission(input);
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

    const contactEmailHash = await sha256(submission.contact.contact_email);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const recent = await svc.entities.PatientRequest.filter({
      contact_email_hash: contactEmailHash,
      created_date: { $gt: oneHourAgo },
    }, '-created_date', 10);
    if (recent.length >= MAX_REQUESTS_PER_EMAIL_PER_HOUR) {
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

    const contactRecord = await svc.entities.PatientRequestContact.create({
      request_id: requestRecord.id,
      requester_user_id: user?.id || '',
      ...submission.contact,
      provider_contact_sharing_consent: false,
      processing_consent_at: nowIso,
      contact_email_verified: Boolean(user?.email && String(user.email).trim().toLowerCase() === submission.contact.contact_email),
      contact_email_verified_at: user?.email && String(user.email).trim().toLowerCase() === submission.contact.contact_email ? nowIso : null,
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

    const validMatches = await validatePublishedMatches(svc, submission.matches);
    if (validMatches.length > 0) {
      await svc.entities.RequestMatch.bulkCreate(
        validMatches.map((match) => ({ request_id: requestRecord.id, ...match })),
      );
    }

    await svc.entities.PatientRequest.update(requestRecord.id, {
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
      message: 'Cererea a fost salvata. Datele de contact nu au fost transmise niciunui furnizor.',
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
    if (error instanceof PatientRequestValidationError) {
      return Response.json({ error: error.message, field: error.field || '' }, { status: 400 });
    }
    return Response.json({ error: 'Cererea nu a putut fi salvata.' }, { status: 500 });
  }
});
