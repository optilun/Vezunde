import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PATIENT_REQUEST_STATUS_CONTRACT_VERSION,
  sanitizePatientProviderResponse,
  sanitizePatientRequestStatus,
} from '../../../shared/patientRequestStatusPolicy.js';
import { maskPatientEmail } from '../../../shared/patientEmailVerificationPolicy.js';
import {
  IN_APP_NOTIFICATION_CONTRACT_VERSION,
  sanitizeInAppNotification,
  summarizeInAppNotifications,
} from '../../../shared/inAppNotificationPolicy.js';
import { ensurePatientInAppNotifications } from '../../../shared/inAppNotificationProjection.js';
import {
  PATIENT_REQUEST_LIFECYCLE_STATES,
  sanitizePatientRequestLifecycle,
} from '../../../shared/patientRequestLifecyclePolicy.js';
import {
  deriveStoredPatientRequestLifecycle,
  reconcilePatientRequestExpiration,
  transitionPatientRequestLifecycle,
} from '../../../shared/patientRequestLifecycleOps.js';
import {
  PATIENT_REQUEST_RECOVERY_CONSENT_VERSION,
  PatientRequestRecoveryValidationError,
  buildPatientRequestRecoveryRecord,
  sanitizePatientRequestRecovery,
} from '../../../shared/patientRequestRecovery.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanList(values, maxItems = 20, maxLength = 180) {
  return Array.isArray(values)
    ? values.map((value) => clean(value, maxLength)).filter(Boolean).slice(0, maxItems)
    : [];
}

function boundedLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function retentionExpired(contact) {
  const retentionUntil = Date.parse(String(contact?.retention_until || ''));
  return Number.isFinite(retentionUntil) && retentionUntil <= Date.now();
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function resolveRequest(svc, requestId, publicReference) {
  if (requestId) return svc.entities.PatientRequest.get(requestId).catch(() => null);
  if (!publicReference) return null;
  const rows = await svc.entities.PatientRequest.filter({ public_reference: publicReference }, '-created_date', 2);
  return rows[0] || null;
}

async function authorizeRequest(svc, requestId, publicReference, accessToken) {
  const request = await resolveRequest(svc, requestId, publicReference);
  if (!request) return { error: 'Cererea nu a fost gasita.', status: 404 };
  const tokenHash = await sha256(accessToken);
  const contacts = await svc.entities.PatientRequestContact.filter({
    request_id: request.id,
    access_token_hash: tokenHash,
    status: 'active',
  }, null, 2);
  const contact = contacts[0];
  if (!contact || retentionExpired(contact)) return { error: 'Accesul la cerere nu este valid sau a expirat.', status: 403 };
  return { request, contact };
}

function patientNotificationFilter(requestId) {
  return {
    recipient_type: 'patient_request',
    recipient_ref_id: requestId,
    request_id: requestId,
  };
}

async function listPatientNotifications(svc, requestId, limit) {
  const filter = patientNotificationFilter(requestId);
  const [rows, allRows] = await Promise.all([
    svc.entities.InAppNotification.filter(filter, '-created_date', boundedLimit(limit)),
    svc.entities.InAppNotification.filter(filter, '-created_date', 500),
  ]);
  return {
    notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION,
    counters: summarizeInAppNotifications(allRows),
    notifications: rows.map(sanitizeInAppNotification),
  };
}

async function markPatientNotificationRead(svc, requestId, notificationId) {
  const notification = await svc.entities.InAppNotification.get(notificationId).catch(() => null);
  if (!notification
    || notification.recipient_type !== 'patient_request'
    || notification.recipient_ref_id !== requestId
    || notification.request_id !== requestId) {
    return { error: 'Notificarea nu a fost gasita.', status: 404 };
  }
  const updated = notification.status === 'read'
    ? notification
    : await svc.entities.InAppNotification.update(notification.id, {
      status: 'read',
      read_at: new Date().toISOString(),
    });
  return { notification: sanitizeInAppNotification(updated) };
}

async function markAllPatientNotificationsRead(svc, requestId) {
  const rows = await svc.entities.InAppNotification.filter({
    ...patientNotificationFilter(requestId),
    status: 'unread',
  }, '-created_date', 500);
  const now = new Date().toISOString();
  await Promise.all(rows.map((row) => svc.entities.InAppNotification.update(row.id, {
    status: 'read',
    read_at: now,
  })));
  return { updated: rows.length };
}

function sanitizeWorkspaceAnswer(answer) {
  return {
    question_key: clean(answer?.question_key, 120),
    question_label: clean(answer?.question_label, 240),
    answer_value: clean(answer?.answer_value, 500),
    answer_label: clean(answer?.answer_label, 500),
  };
}

function publicLocation(location) {
  return location?.status === 'publicata'
    && location?.active_status !== 'inactiva'
    && location?.is_active !== false
    && location?.profile_control_status !== 'suspended';
}

function sanitizeWorkspaceResult(match, location) {
  if (!location || !publicLocation(location)) return null;
  return {
    id: clean(location.id, 120),
    public_display_name: clean(location.public_display_name || location.name || 'Locatie', 180),
    name: clean(location.name || location.public_display_name || 'Locatie', 180),
    locality_name: clean(location.locality_name || location.city, 120),
    city: clean(location.city || location.locality_name, 120),
    provider_type: clean(location.provider_type, 80),
    profile_control_status: clean(location.profile_control_status || match?.profile_control_status_snapshot || 'directory', 40),
    result_bucket: clean(match?.result_bucket, 40),
    rank: Number(match?.rank) || 0,
    bucket_rank: Number(match?.bucket_rank) || 0,
    matched_service_keys: cleanList(match?.matched_service_keys, 30, 120),
    match_reasons: cleanList(match?.match_reasons, 20, 240),
    recommendation_explanations: cleanList(match?.recommendation_explanations, 20, 240),
  };
}

async function buildWorkspacePayload(svc, request) {
  const [answers, matches] = await Promise.all([
    svc.entities.PatientRequestAnswer.filter({ request_id: request.id }, 'position', 100),
    svc.entities.RequestMatch.filter({ request_id: request.id }, 'rank', 100),
  ]);
  const resolvedResults = await Promise.all(matches.map(async (match) => {
    const location = await svc.entities.ProviderLocation.get(match.location_id).catch(() => null);
    return sanitizeWorkspaceResult(match, location);
  }));

  return {
    detailed_message: clean(request.detailed_message || request.original_message, 2000),
    request_draft: {
      intent: clean(request.intent, 120),
      city: clean(request.city, 120),
      county: clean(request.county, 120),
      for_whom: clean(request.for_whom, 40),
      timing_key: clean(request.timing_key, 120),
      preferences: cleanList(request.preferences, 30, 160),
      answers: answers.map(sanitizeWorkspaceAnswer),
      interpretation: {
        possible_safety_flags: cleanList(request.possible_safety_flags, 20, 160),
      },
    },
    meta: {
      recommendation_contract_version: clean(request.recommendation_contract_version, 120),
      coverage_status: clean(request.matching_coverage_status, 80),
      need_level: clean(request.matching_need_level, 80),
    },
    results: resolvedResults.filter(Boolean),
  };
}

async function findRecoveryCase(svc, requestId) {
  const rows = await svc.entities.PatientRequestRecoveryCase.filter({ request_id: requestId }, '-created_date', 5);
  return rows[0] || null;
}

async function createRecoveryCase(svc, request, input) {
  if (input.recovery_consent !== true
    || clean(input.recovery_consent_version, 120) !== PATIENT_REQUEST_RECOVERY_CONSENT_VERSION) {
    return { error: 'Acordul pentru verificarea cererii nu este valid.', status: 400 };
  }

  const lifecycleSnapshot = await deriveStoredPatientRequestLifecycle(svc, request);
  if (lifecycleSnapshot.lifecycle?.state !== PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE) {
    return { error: 'Cererea nu mai poate fi trimisa pentru verificare.', status: 409 };
  }
  if (Number(request.match_count || 0) > 0) {
    return { error: 'Verificarea interna este disponibila numai pentru cererile fara rezultate.', status: 409 };
  }

  const existing = await findRecoveryCase(svc, request.id);
  if (existing) return { recovery: existing, idempotent_replay: true };

  try {
    const record = buildPatientRequestRecoveryRecord({
      request,
      consentVersion: clean(input.recovery_consent_version, 120),
      coverageCounts: input.coverage_counts || {},
    });
    const recovery = await svc.entities.PatientRequestRecoveryCase.create(record);
    return { recovery, idempotent_replay: false };
  } catch (error) {
    if (error instanceof PatientRequestRecoveryValidationError) {
      return { error: error.message, status: 400 };
    }
    throw error;
  }
}

async function buildStatusPayload(svc, request, contact) {
  const expiration = await reconcilePatientRequestExpiration(svc, request.id);
  const currentRequest = expiration.request || request;
  const lifecycleSnapshot = expiration.lifecycle
    ? { lifecycle: expiration.lifecycle }
    : await deriveStoredPatientRequestLifecycle(svc, currentRequest);
  const lifecycle = lifecycleSnapshot.lifecycle;

  if (
    currentRequest.lifecycle_state !== lifecycle.state
    || currentRequest.lifecycle_stage !== lifecycle.stage
    || !currentRequest.lifecycle_contract_version
  ) {
    await svc.entities.PatientRequest.update(currentRequest.id, {
      lifecycle_contract_version: 'patient-request-lifecycle-v1',
      lifecycle_state: lifecycle.state,
      lifecycle_stage: lifecycle.stage,
      lifecycle_updated_at: new Date().toISOString(),
    }).catch(() => null);
  }

  const [rows, approvalRows, openConversations, workspace, recovery] = await Promise.all([
    svc.entities.ProviderLeadResponse.filter({ request_id: currentRequest.id, status: 'active' }, '-updated_date', 100),
    svc.entities.ContactShareApproval.filter({ request_id: currentRequest.id }, '-updated_date', 100),
    svc.entities.PatientRequestConversation.filter({ request_id: currentRequest.id, status: 'open' }, '-updated_date', 100),
    buildWorkspacePayload(svc, currentRequest),
    findRecoveryCase(svc, currentRequest.id),
  ]);
  const approvalByLocation = new Map();
  for (const approval of approvalRows) {
    if (!approval.location_id || approvalByLocation.has(approval.location_id)) continue;
    approvalByLocation.set(approval.location_id, approval);
  }

  const responses = [];
  const seenLocations = new Set();
  for (const row of rows) {
    if (!row.location_id || seenLocations.has(row.location_id)) continue;
    const location = await svc.entities.ProviderLocation.get(row.location_id).catch(() => null);
    if (!location) continue;
    seenLocations.add(row.location_id);
    responses.push(sanitizePatientProviderResponse(row, location, approvalByLocation.get(row.location_id) || null));
  }

  return {
    contract_version: PATIENT_REQUEST_STATUS_CONTRACT_VERSION,
    request: sanitizePatientRequestStatus({ ...currentRequest, lifecycle_state: lifecycle.state, lifecycle_stage: lifecycle.stage }),
    lifecycle: sanitizePatientRequestLifecycle(lifecycle),
    workspace,
    distribution_authorized: contact.provider_request_distribution_consent === true,
    recovery_allowed: lifecycle.state === PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE && Number(currentRequest.match_count || 0) === 0,
    recovery: sanitizePatientRequestRecovery(recovery),
    response_count: responses.length,
    responses,
    contact_email_verified: contact.contact_email_verified === true,
    contact_email_masked: maskPatientEmail(contact.contact_email),
    contact_phone_available: Boolean(clean(contact.contact_phone, 32)),
    phone_sharing_enabled: responses.some((response) => response.contact_share_status === 'approved'),
    contact_sharing_enabled: responses.some((response) => response.contact_share_status === 'approved'),
    conversation_enabled: lifecycle.state === PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE && openConversations.length > 0,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'status', 40);
    const requestId = clean(input.request_id, 120);
    const publicReference = clean(input.public_reference, 120);
    const accessToken = clean(input.request_access_token, 160);
    if ((!requestId && !publicReference) || !accessToken) {
      return res({ error: 'Referinta cererii si tokenul de acces sunt obligatorii.' }, 400);
    }

    const authorized = await authorizeRequest(svc, requestId, publicReference, accessToken);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);
    const authorizedRequestId = authorized.request.id;

    if (action === 'recovery_request') {
      const result = await createRecoveryCase(svc, authorized.request, input);
      if (result.error) return res({ error: result.error }, result.status);
      return res({
        ...(await buildStatusPayload(svc, authorized.request, authorized.contact)),
        idempotent_replay: result.idempotent_replay,
      });
    }

    if (action === 'resolve' || action === 'close') {
      const targetState = action === 'resolve'
        ? PATIENT_REQUEST_LIFECYCLE_STATES.RESOLVED
        : PATIENT_REQUEST_LIFECYCLE_STATES.CLOSED;
      const transitioned = await transitionPatientRequestLifecycle({
        svc,
        requestId: authorizedRequestId,
        targetState,
        actor: 'patient',
      });
      if (transitioned.error) return res({ error: transitioned.error }, transitioned.status);
      await ensurePatientInAppNotifications({ svc, requestId: authorizedRequestId }).catch(() => []);
      return res({
        ...(await buildStatusPayload(svc, transitioned.request, authorized.contact)),
        idempotent_replay: transitioned.idempotent_replay,
      });
    }

    if (action === 'notifications_list') {
      await reconcilePatientRequestExpiration(svc, authorizedRequestId).catch(() => null);
      await ensurePatientInAppNotifications({ svc, requestId: authorizedRequestId }).catch(() => []);
      return res(await listPatientNotifications(svc, authorizedRequestId, input.limit));
    }
    if (action === 'notification_mark_read') {
      const notificationId = clean(input.notification_id, 120);
      if (!notificationId) return res({ error: 'notification_id este obligatoriu.' }, 400);
      const result = await markPatientNotificationRead(svc, authorizedRequestId, notificationId);
      if (result.error) return res({ error: result.error }, result.status);
      return res({ notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION, ...result });
    }
    if (action === 'notifications_mark_all_read') {
      return res({
        notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION,
        ...(await markAllPatientNotificationsRead(svc, authorizedRequestId)),
      });
    }
    if (action !== 'status') return res({ error: 'Actiune necunoscuta.' }, 400);

    return res(await buildStatusPayload(svc, authorized.request, authorized.contact));
  } catch (_error) {
    return res({ error: 'Statusul cererii nu a putut fi incarcat.' }, 500);
  }
});
