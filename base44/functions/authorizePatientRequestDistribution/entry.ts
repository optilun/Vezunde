import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  acquirePatientRequestDistributionLock,
  releasePatientRequestDistributionLock,
} from '../../../shared/patientRequestDistributionLock.js';
import {
  PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION,
  PROVIDER_LEAD_CONTRACT_VERSION,
  PROVIDER_LEAD_ELIGIBILITY_POLICY_VERSION,
  buildProviderLeadPreview,
  evaluateProviderLeadEligibility,
  patientIntentLabel,
} from '../../../shared/providerLeadEligibility.js';
import { notifyProviderLeadAvailable } from '../../../shared/leadCommunicationNotifications.js';

function clean(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function expired(request) {
  const expiresAt = Date.parse(String(request?.expires_at || ''));
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

async function loadAuthorizedRequest(svc, requestId, accessToken) {
  const request = await svc.entities.PatientRequest.get(requestId).catch(() => null);
  if (!request) return { error: 'Cererea nu a fost gasita.', status: 404 };
  const tokenHash = await sha256(accessToken);
  const contacts = await svc.entities.PatientRequestContact.filter({
    request_id: requestId,
    access_token_hash: tokenHash,
    status: 'active',
  }, null, 2);
  const contact = contacts[0];
  if (!contact) return { error: 'Accesul la cerere nu este valid.', status: 403 };
  return { request, contact };
}

async function eligibleLeadPlans(svc, request) {
  const matches = await svc.entities.RequestMatch.filter({ request_id: request.id }, 'rank', 30);
  const plans = [];
  for (const match of matches) {
    const location = await svc.entities.ProviderLocation.get(match.location_id).catch(() => null);
    if (!location) continue;
    const services = await svc.entities.LocationService.filter({ location_id: location.id }, null, 500);
    const eligibility = evaluateProviderLeadEligibility({ request, match, location, services });
    if (!eligibility.eligible) continue;
    plans.push({ match, location, eligibility });
  }
  return plans;
}

function isTop3FullDetailLead(lead) {
  return lead?.access_tier === 'pro_full' && lead?.result_bucket_snapshot === 'top3';
}

Deno.serve(async (httpRequest) => {
  let distributionLock = null;
  let svc = null;
  try {
    const base44 = createClientFromRequest(httpRequest);
    svc = base44.asServiceRole;
    const input = await httpRequest.json().catch(() => ({}));
    const requestId = clean(input.request_id, 120);
    const accessToken = clean(input.request_access_token, 160);
    const consentVersion = clean(input.consent_version, 120);

    if (!requestId || !accessToken) {
      return Response.json({ error: 'request_id si tokenul de acces sunt obligatorii.' }, { status: 400 });
    }
    if (input.distribution_consent !== true || consentVersion !== PATIENT_REQUEST_DISTRIBUTION_CONSENT_VERSION) {
      return Response.json({ error: 'Acordul pentru trimiterea cererii nu este valid.' }, { status: 400 });
    }

    const authorized = await loadAuthorizedRequest(svc, requestId, accessToken);
    if (authorized.error) return Response.json({ error: authorized.error }, { status: authorized.status });
    const { request, contact } = authorized;
    if (request.persistence_state !== 'complete') {
      return Response.json({ error: 'Cererea nu este pregatita pentru distribuire.' }, { status: 409 });
    }
    if (['retrasa', 'inchisa', 'expirata'].includes(request.status) || expired(request)) {
      return Response.json({ error: 'Cererea nu mai poate fi trimisa.' }, { status: 409 });
    }

    distributionLock = await acquirePatientRequestDistributionLock(svc, request.id);
    if (!distributionLock) {
      return Response.json({ error: 'Cererea este deja in curs de procesare. Incearca din nou.' }, { status: 409 });
    }

    const lockedRequest = await svc.entities.PatientRequest.get(request.id).catch(() => null);
    if (!lockedRequest) return Response.json({ error: 'Cererea nu a fost gasita.' }, { status: 404 });
    if (lockedRequest.persistence_state !== 'complete') {
      return Response.json({ error: 'Cererea nu este pregatita pentru distribuire.' }, { status: 409 });
    }
    if (['retrasa', 'inchisa', 'expirata'].includes(lockedRequest.status) || expired(lockedRequest)) {
      return Response.json({ error: 'Cererea nu mai poate fi trimisa.' }, { status: 409 });
    }

    const existingLeads = await svc.entities.ProviderLead.filter({ request_id: lockedRequest.id }, null, 100);
    if (existingLeads.length > 0) {
      if (contact.provider_request_distribution_consent !== true
        || contact.provider_request_distribution_consent_version !== consentVersion) {
        await svc.entities.PatientRequestContact.update(contact.id, {
          provider_request_distribution_consent: true,
          provider_request_distribution_consent_version: consentVersion,
          provider_request_distribution_consent_at: new Date().toISOString(),
        });
      }
      return Response.json({
        success: true,
        idempotent_replay: true,
        lead_count: existingLeads.filter((lead) => lead.delivery_state === 'available').length,
        top3_full_detail_count: existingLeads.filter(isTop3FullDetailLead).length,
        contact_sharing_enabled: false,
        conversation_enabled: false,
      });
    }

    const plans = await eligibleLeadPlans(svc, lockedRequest);
    const now = new Date().toISOString();
    const leadRows = plans.map(({ match, location, eligibility }) => ({
      request_id: lockedRequest.id,
      request_match_id: match.id,
      organization_id: location.organization_id || '',
      location_id: location.id,
      lead_contract_version: PROVIDER_LEAD_CONTRACT_VERSION,
      eligibility_policy_version: PROVIDER_LEAD_ELIGIBILITY_POLICY_VERSION,
      intent: lockedRequest.intent,
      intent_label: patientIntentLabel(lockedRequest.intent),
      service_keys: lockedRequest.service_keys || [],
      city: lockedRequest.city || '',
      county: lockedRequest.county || '',
      for_whom: lockedRequest.for_whom || '',
      age_group: lockedRequest.age_group || '',
      timing_key: lockedRequest.timing_key || '',
      result_bucket_snapshot: match.result_bucket || '',
      need_level_snapshot: match.need_level_snapshot || lockedRequest.matching_need_level || '',
      profile_control_status_snapshot: location.profile_control_status || '',
      matched_service_keys: eligibility.matched_service_keys,
      preview_summary: buildProviderLeadPreview(lockedRequest),
      access_tier: match.result_bucket === 'top3' ? 'pro_full' : 'free_preview',
      contact_access_state: 'hidden',
      conversation_access_state: 'locked',
      delivery_state: 'available',
      status: 'new',
      eligible_at: now,
      last_revalidated_at: now,
      expires_at: lockedRequest.expires_at || null,
      eligibility_reasons: [
        'request_distribution_consent',
        'server_revalidated',
        ...(match.result_bucket === 'top3' ? ['top3_pro_full_details_eligible'] : []),
      ],
    }));

    if (leadRows.length > 0) await svc.entities.ProviderLead.bulkCreate(leadRows);

    await Promise.all([
      svc.entities.PatientRequestContact.update(contact.id, {
        provider_request_distribution_consent: true,
        provider_request_distribution_consent_version: consentVersion,
        provider_request_distribution_consent_at: now,
        provider_contact_sharing_consent: false,
      }),
      svc.entities.PatientRequest.update(lockedRequest.id, {
        status: leadRows.length > 0 ? 'pregatita_pentru_distribuire' : 'salvata',
      }),
    ]);

    if (leadRows.length > 0) {
      const createdLeads = await svc.entities.ProviderLead.filter({ request_id: lockedRequest.id }, null, 100);
      const locationsById = new Map(plans.map((plan) => [plan.location.id, plan.location]));
      await Promise.allSettled(createdLeads.map((lead) => {
        const location = locationsById.get(lead.location_id);
        if (!location) return Promise.resolve(null);
        return notifyProviderLeadAvailable({ base44, svc, lead, location });
      }));
    }

    const top3FullDetailCount = leadRows.filter(isTop3FullDetailLead).length;
    return Response.json({
      success: true,
      idempotent_replay: false,
      lead_count: leadRows.length,
      top3_full_detail_count: top3FullDetailCount,
      contact_sharing_enabled: false,
      conversation_enabled: false,
      message: leadRows.length > 0
        ? 'Rezumatul este disponibil locatiilor eligibile. Locatiile Pro din Top 3 pot vedea numele, mesajul detaliat si emailul verificat. Telefonul ramane ascuns.'
        : 'Cererea a fost salvata, dar momentan nu exista locatii eligibile pentru distribuire.',
    });
  } catch (_error) {
    return Response.json({ error: 'Cererea nu a putut fi pregatita pentru distribuire.' }, { status: 500 });
  } finally {
    if (svc && distributionLock) await releasePatientRequestDistributionLock(svc, distributionLock);
  }
});
