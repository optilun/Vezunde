import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  IN_APP_NOTIFICATION_CONTRACT_VERSION,
  sanitizeInAppNotification,
} from '../../shared/inAppNotificationPolicy.js';
import { ensurePatientInAppNotifications } from '../../shared/inAppNotificationProjection.js';
import { patientIntentLabel } from '../../shared/providerLeadEligibility.js';
import { filterByIdList } from '../../shared/providerWorkspaceBatchQueries.js';

// 2026-10-04 (structura conturilor, pasul 5). „Notificări” in contul personal: actualizarile
// tuturor cererilor trimise din cont (raspunsuri, mesaje, expirare), intr-un singur loc. Pana acum
// apareau doar in pagina fiecarei cereri, deschisa cu linkul securizat.
//
// Notificarile sunt aceleasi randuri InAppNotification pe care le arata pagina cererii
// (`recipient_type: 'patient_request'`), deci „citit” aici inseamna „citit” si acolo.

export const MY_PATIENT_NOTIFICATIONS_CONTRACT_VERSION = 'my-patient-notifications-v1';
const MAX_REQUESTS = 50;
// Proiectia (crearea notificarilor noi) ruleaza doar pentru cererile active cele mai recente,
// ca pagina sa ramana rapida. Restul cererilor isi pastreaza notificarile deja create.
const MAX_PROJECTED_REQUESTS = 10;
const MAX_NOTIFICATIONS = 100;

function clean(value, maxLength = 120) {
  return String(value ?? '').trim().slice(0, maxLength);
}

async function loadMyRequests(svc, userId) {
  const rows = await svc.entities.PatientRequest.filter({ requester_user_id: userId, persistence_state: 'complete' }, '-created_date', MAX_REQUESTS);
  return rows.filter((request) => request.requester_user_id === userId && request.id);
}

function belongsTo(notification, requestsById) {
  return notification?.recipient_type === 'patient_request'
    && notification.recipient_ref_id
    && notification.recipient_ref_id === notification.request_id
    && requestsById.has(notification.request_id);
}

async function loadMyNotifications(svc, requests, query = {}) {
  const requestsById = new Map(requests.map((request) => [request.id, request]));
  if (!requestsById.size) return { requestsById, rows: [] };
  const rows = await filterByIdList(svc.entities.InAppNotification, 'request_id', [...requestsById.keys()],
    { recipient_type: 'patient_request', ...query }, { sort: '-created_date', maxPages: 2 });
  return { requestsById, rows: rows.filter((row) => belongsTo(row, requestsById)) };
}

function byNewest(a, b) {
  return String(b.created_date || '').localeCompare(String(a.created_date || ''));
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list', 40);
    const requests = await loadMyRequests(svc, user.id);

    if (action === 'list') {
      const projected = requests.filter((request) => !request.lifecycle_state || request.lifecycle_state === 'active').slice(0, MAX_PROJECTED_REQUESTS);
      for (const request of projected) await ensurePatientInAppNotifications({ svc, requestId: request.id }).catch(() => []);
      const { requestsById, rows } = await loadMyNotifications(svc, requests);
      const sorted = [...rows].sort(byNewest);
      return Response.json({
        contract_version: MY_PATIENT_NOTIFICATIONS_CONTRACT_VERSION,
        notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION,
        counters: { total: sorted.length, unread: sorted.filter((row) => row.status === 'unread').length },
        notifications: sorted.slice(0, MAX_NOTIFICATIONS).map((row) => {
          const request = requestsById.get(row.request_id);
          return {
            ...sanitizeInAppNotification(row),
            request_id: request.id,
            request_reference: clean(request.public_reference),
            request_label: patientIntentLabel(request.intent),
          };
        }),
        truncated: sorted.length > MAX_NOTIFICATIONS,
      });
    }

    if (action === 'mark_read') {
      const notificationId = clean(input.notification_id);
      if (!notificationId) return Response.json({ error: 'Alege notificarea.' }, { status: 400 });
      const notification = await svc.entities.InAppNotification.get(notificationId).catch(() => null);
      const requestsById = new Map(requests.map((request) => [request.id, request]));
      if (!belongsTo(notification, requestsById)) return Response.json({ error: 'Notificarea nu a fost găsită.' }, { status: 404 });
      if (notification.status !== 'read') {
        await svc.entities.InAppNotification.update(notification.id, { status: 'read', read_at: new Date().toISOString() });
      }
      return Response.json({ ok: true });
    }

    if (action === 'mark_all_read') {
      const { rows } = await loadMyNotifications(svc, requests, { status: 'unread' });
      const now = new Date().toISOString();
      const unread = rows.filter((row) => row.status === 'unread');
      for (const row of unread) await svc.entities.InAppNotification.update(row.id, { status: 'read', read_at: now });
      return Response.json({ ok: true, updated: unread.length });
    }

    return Response.json({ error: 'Acțiune necunoscută.' }, { status: 400 });
  } catch (_error) {
    return Response.json({ error: 'Notificările nu au putut fi încărcate.' }, { status: 500 });
  }
}
