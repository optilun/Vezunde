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

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function boundedLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function authorizeRequest(svc, requestId, accessToken) {
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

  const [rows, approvalRows, openConversations] = await Promise.all([
    svc.entities.ProviderLeadResponse.filter({ request_id: currentRequest.id, status: 'active' }, '-updated_date', 100),
    svc.entities.ContactShareApproval.filter({ request_id: currentRequest.id }, '-updated_date', 100),
    svc.entities.PatientRequestConversation.filter({ request_id: currentRequest.id, status: 'open' }, '-updated_date', 100),
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
    const accessToken = clean(input.request_access_token, 160);
    if (!requestId || !accessToken) return res({ error: 'request_id si tokenul de acces sunt obligatorii.' }, 400);

    const authorized = await authorizeRequest(svc, requestId, accessToken);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    if (action === 'resolve' || action === 'close') {
      const targetState = action === 'resolve'
        ? PATIENT_REQUEST_LIFECYCLE_STATES.RESOLVED
        : PATIENT_REQUEST_LIFECYCLE_STATES.CLOSED;
      const transitioned = await transitionPatientRequestLifecycle({
        svc,
        requestId,
        targetState,
        actor: 'patient',
      });
      if (transitioned.error) return res({ error: transitioned.error }, transitioned.status);
      await ensurePatientInAppNotifications({ svc, requestId }).catch(() => []);
      return res({
        ...(await buildStatusPayload(svc, transitioned.request, authorized.contact)),
        idempotent_replay: transitioned.idempotent_replay,
      });
    }

    if (action === 'notifications_list') {
      await reconcilePatientRequestExpiration(svc, requestId).catch(() => null);
      await ensurePatientInAppNotifications({ svc, requestId }).catch(() => []);
      return res(await listPatientNotifications(svc, requestId, input.limit));
    }
    if (action === 'notification_mark_read') {
      const notificationId = clean(input.notification_id, 120);
      if (!notificationId) return res({ error: 'notification_id este obligatoriu.' }, 400);
      const result = await markPatientNotificationRead(svc, requestId, notificationId);
      if (result.error) return res({ error: result.error }, result.status);
      return res({ notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION, ...result });
    }
    if (action === 'notifications_mark_all_read') {
      return res({
        notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION,
        ...(await markAllPatientNotificationsRead(svc, requestId)),
      });
    }
    if (action !== 'status') return res({ error: 'Actiune necunoscuta.' }, 400);

    return res(await buildStatusPayload(svc, authorized.request, authorized.contact));
  } catch (_error) {
    return res({ error: 'Statusul cererii nu a putut fi incarcat.' }, 500);
  }
});
