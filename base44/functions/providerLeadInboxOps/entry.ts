import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
  canAccessProviderLeadInbox,
  filterProviderLeadInbox,
  sanitizeProviderLeadForFreeInbox,
  summarizeProviderLeadInbox,
} from '../../shared/providerLeadInboxPolicy.js';
import { resolveProviderEntitlement } from '../../shared/providerEntitlementPolicy.js';
import {
  PROVIDER_LEAD_FULL_DETAILS_CONTRACT_VERSION,
  buildProviderLeadFullDetails,
  providerLeadFullDetailsEligibility,
  sanitizeProviderLeadFullDetailsStatus,
} from '../../shared/providerLeadFullDetailsPolicy.js';
import {
  IN_APP_NOTIFICATION_CONTRACT_VERSION,
  sanitizeInAppNotification,
  summarizeInAppNotifications,
} from '../../shared/inAppNotificationPolicy.js';
import { ensureProviderInAppNotifications } from '../../shared/inAppNotificationProjection.js';
import { reconcilePatientRequestExpiration } from '../../shared/patientRequestLifecycleOps.js';

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

async function authorizeLocation(svc, user, locationId) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };
  if (user.role === 'admin') return { location, role: 'admin' };
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  const membership = memberships.find((row) => canAccessProviderLeadInbox(row?.role));
  if (!membership) return { error: 'Nu ai acces la leadurile acestei locatii.', status: 403 };
  return { location, role: membership.role };
}

function safeLocation(location) {
  return {
    id: location.id,
    name: location.public_display_name || location.name || 'Locatie',
    city: location.locality_name || location.city || '',
    county: location.county_name || location.county || '',
  };
}

async function entitlementForLocation(svc, locationId) {
  const rows = await svc.entities.ProviderSubscription.filter({ location_id: locationId }, '-created_date', 100);
  return resolveProviderEntitlement(rows);
}

async function reconcileLocationExpirations(svc, locationId) {
  const rows = await svc.entities.ProviderLead.filter({
    location_id: locationId,
    delivery_state: 'available',
  }, '-created_date', 500);
  const now = Date.now();
  const requestIds = [...new Set(rows
    .filter((lead) => {
      const expiresAt = Date.parse(String(lead?.expires_at || ''));
      return lead?.request_id && Number.isFinite(expiresAt) && expiresAt <= now;
    })
    .map((lead) => lead.request_id))];
  await Promise.allSettled(requestIds.map((requestId) => reconcilePatientRequestExpiration(svc, requestId)));
}

async function auditFullDetailsRead(svc, lead, user, entitlement, fields) {
  await svc.entities.ProviderLeadContactAccessAudit.create({
    lead_id: lead.id,
    request_id: lead.request_id || '',
    organization_id: lead.organization_id || '',
    location_id: lead.location_id || '',
    accessor_user_id: user.id,
    access_contract_version: PROVIDER_LEAD_FULL_DETAILS_CONTRACT_VERSION,
    outcome: 'granted',
    reason: 'top3_pro_full_details',
    accessed_fields: fields,
    entitlement_plan_code: entitlement.plan_code || 'free',
    approval_contract_version: '',
    accessed_at: new Date().toISOString(),
  });
}

async function enrichLeadForInbox(svc, lead, user, entitlement) {
  const safe = sanitizeProviderLeadForFreeInbox(lead);
  if (lead.access_tier !== 'pro_full' || lead.result_bucket_snapshot !== 'top3') {
    return {
      ...safe,
      full_details_status: sanitizeProviderLeadFullDetailsStatus({ eligible: false, reasons: ['lead_not_top3'] }),
    };
  }

  const [request, contacts] = await Promise.all([
    svc.entities.PatientRequest.get(lead.request_id).catch(() => null),
    svc.entities.PatientRequestContact.filter({ request_id: lead.request_id, status: 'active' }, '-updated_date', 2),
  ]);
  const contact = contacts[0] || null;
  const eligibility = providerLeadFullDetailsEligibility({ lead, request, contact, entitlement });
  const status = sanitizeProviderLeadFullDetailsStatus(eligibility);
  if (!eligibility.eligible) {
    const preserveProHistoryScope = safe.is_historical && entitlement?.plan_code === 'pro';
    return {
      ...safe,
      ...(preserveProHistoryScope ? { access_tier: 'pro_full' } : {}),
      full_details_status: status,
    };
  }

  const fullDetails = buildProviderLeadFullDetails({ request, contact });
  const accessedFields = ['contact_name', 'detailed_message'];
  if (fullDetails.client_email) accessedFields.push('contact_email');
  await auditFullDetailsRead(svc, lead, user, entitlement, accessedFields);
  return {
    ...safe,
    access_tier: 'pro_full',
    full_details_status: status,
    full_details: fullDetails,
  };
}

function providerNotificationFilter(userId, locationId) {
  return {
    recipient_type: 'provider_user',
    recipient_ref_id: userId,
    location_id: locationId,
  };
}

async function listProviderNotifications(svc, userId, locationId, limit) {
  const filter = providerNotificationFilter(userId, locationId);
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

async function markProviderNotificationRead(svc, userId, locationId, notificationId) {
  const notification = await svc.entities.InAppNotification.get(notificationId).catch(() => null);
  if (!notification
    || notification.recipient_type !== 'provider_user'
    || notification.recipient_ref_id !== userId
    || notification.location_id !== locationId) {
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

async function markAllProviderNotificationsRead(svc, userId, locationId) {
  const rows = await svc.entities.InAppNotification.filter({
    ...providerNotificationFilter(userId, locationId),
    status: 'unread',
  }, '-created_date', 500);
  const now = new Date().toISOString();
  await Promise.all(rows.map((row) => svc.entities.InAppNotification.update(row.id, {
    status: 'read',
    read_at: now,
  })));
  return { updated: rows.length };
}

const FUNCTION_DEPLOY_REVISION = 'viasee-runtime-resync-2026-07-22-providerLeadInboxOps-3';
console.info(`[VIASEE] providerLeadInboxOps ${FUNCTION_DEPLOY_REVISION}`);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara.' }, 401);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list', 40);
    const locationId = clean(input.location_id, 120);
    if (!locationId) return res({ error: 'location_id este obligatoriu.' }, 400);

    const authorized = await authorizeLocation(svc, user, locationId);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    if (action === 'notifications_list') {
      await reconcileLocationExpirations(svc, locationId).catch(() => null);
      await ensureProviderInAppNotifications({ svc, userId: user.id, locationId }).catch(() => []);
      return res(await listProviderNotifications(svc, user.id, locationId, input.limit));
    }
    if (action === 'notification_mark_read') {
      const notificationId = clean(input.notification_id, 120);
      if (!notificationId) return res({ error: 'notification_id este obligatoriu.' }, 400);
      const result = await markProviderNotificationRead(svc, user.id, locationId, notificationId);
      if (result.error) return res({ error: result.error }, result.status);
      return res({ notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION, ...result });
    }
    if (action === 'notifications_mark_all_read') {
      return res({
        notification_contract_version: IN_APP_NOTIFICATION_CONTRACT_VERSION,
        ...(await markAllProviderNotificationsRead(svc, user.id, locationId)),
      });
    }

    if (action === 'mark_viewed') {
      const leadId = clean(input.lead_id, 120);
      if (!leadId) return res({ error: 'lead_id este obligatoriu.' }, 400);
      const lead = await svc.entities.ProviderLead.get(leadId).catch(() => null);
      if (!lead || lead.location_id !== locationId) return res({ error: 'Leadul nu a fost gasit.' }, 404);
      if (lead.delivery_state !== 'available') return res({ error: 'Leadul nu mai este disponibil.' }, 409);
      const updated = lead.status === 'new'
        ? await svc.entities.ProviderLead.update(lead.id, { status: 'viewed' })
        : lead;
      return res({ contract_version: PROVIDER_LEAD_INBOX_CONTRACT_VERSION, lead: sanitizeProviderLeadForFreeInbox(updated) });
    }

    if (action !== 'list') return res({ error: 'Actiune necunoscuta.' }, 400);
    await reconcileLocationExpirations(svc, locationId).catch(() => null);
    const requestedScope = clean(input.scope, 40) === 'history' ? 'history' : 'active';
    const requestedStatus = clean(input.status, 80);
    const [allRows, entitlement] = await Promise.all([
      svc.entities.ProviderLead.filter({ location_id: locationId }, '-created_date', 500),
      entitlementForLocation(svc, locationId),
    ]);
    const rows = filterProviderLeadInbox(allRows, {
      scope: requestedScope,
      status: requestedStatus,
      limit: input.limit,
    });
    const leads = await Promise.all(rows.map((lead) => enrichLeadForInbox(svc, lead, user, entitlement)));

    return res({
      contract_version: PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
      scope: requestedScope,
      entitlement,
      access_tier: entitlement.plan_code === 'pro' ? 'pro_full_when_top3' : 'free_preview',
      contact_access_state: 'phone_hidden_until_patient_approval',
      conversation_access_state: 'locked',
      location: safeLocation(authorized.location),
      counters: summarizeProviderLeadInbox(allRows),
      leads,
    });
  } catch (_error) {
    return res({ error: 'Leadurile nu au putut fi incarcate.' }, 500);
  }
});