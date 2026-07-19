import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { canAccessProviderLeadInbox } from '../../../shared/providerLeadInboxPolicy.js';
import { hasProviderFeature, resolveProviderEntitlement } from '../../../shared/providerEntitlementPolicy.js';
import {
  PROVIDER_LEAD_RESPONSE_CONTRACT_VERSION,
  normalizeProviderLeadResponseType,
  providerLeadStatusForResponse,
  sanitizeProviderLeadResponse,
} from '../../../shared/providerLeadResponsePolicy.js';
import {
  acquireProviderLeadResponseLock,
  releaseProviderLeadResponseLock,
} from '../../../shared/providerLeadResponseLock.js';

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

function expired(lead) {
  const parsed = Date.parse(String(lead?.expires_at || ''));
  return Number.isFinite(parsed) && parsed <= Date.now();
}

async function authorizeLocation(svc, user, locationId) {
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };
  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  const membership = memberships.find((row) => canAccessProviderLeadInbox(row?.role));
  if (!membership) return { error: 'Nu ai acces la raspunsurile acestei locatii.', status: 403 };
  return { location, membership };
}

async function requireResponseEntitlement(svc, locationId) {
  const subscriptions = await svc.entities.ProviderSubscription.filter({ location_id: locationId }, '-created_date', 100);
  const entitlement = resolveProviderEntitlement(subscriptions);
  if (!hasProviderFeature(entitlement, 'provider_leads.respond')) {
    return { error: 'Raspunsul la leaduri este disponibil in planul Pro.', status: 402, entitlement };
  }
  return { entitlement };
}

async function loadLead(svc, leadId, locationId) {
  const lead = await svc.entities.ProviderLead.get(leadId).catch(() => null);
  if (!lead || lead.location_id !== locationId) return { error: 'Leadul nu a fost gasit.', status: 404 };
  if (lead.delivery_state !== 'available' || expired(lead) || ['closed', 'expired'].includes(lead.status)) {
    return { error: 'Leadul nu mai accepta raspunsuri.', status: 409 };
  }
  return { lead };
}

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
    const access = await requireResponseEntitlement(svc, locationId);
    if (access.error) return res({ error: access.error, entitlement: access.entitlement }, access.status);

    if (action === 'list') {
      const rows = await svc.entities.ProviderLeadResponse.filter({
        location_id: locationId,
        status: 'active',
      }, '-updated_date', 500);
      return res({
        entitlement: access.entitlement,
        responses: rows.map(sanitizeProviderLeadResponse),
      });
    }

    if (action !== 'submit') return res({ error: 'Actiune necunoscuta.' }, 400);

    const leadId = clean(input.lead_id, 120);
    const responseType = normalizeProviderLeadResponseType(input.response_type);
    if (!leadId) return res({ error: 'lead_id este obligatoriu.' }, 400);
    if (!responseType) return res({ error: 'Tipul raspunsului nu este valid.' }, 400);

    const initialLead = await loadLead(svc, leadId, locationId);
    if (initialLead.error) return res({ error: initialLead.error }, initialLead.status);

    const lock = await acquireProviderLeadResponseLock(svc, leadId);
    if (!lock) return res({ error: 'Raspunsul este actualizat in alta sesiune. Reincearca.' }, 409);

    try {
      const checked = await loadLead(svc, leadId, locationId);
      if (checked.error) return res({ error: checked.error }, checked.status);
      const lead = checked.lead;
      const now = new Date().toISOString();
      const activeRows = await svc.entities.ProviderLeadResponse.filter({
        lead_id: leadId,
        location_id: locationId,
        status: 'active',
      }, '-updated_date', 20);
      const existing = activeRows[0] || null;
      const payload = {
        lead_id: lead.id,
        request_id: lead.request_id || '',
        organization_id: lead.organization_id || authorized.location.organization_id || '',
        location_id: locationId,
        responder_user_id: user.id,
        response_contract_version: PROVIDER_LEAD_RESPONSE_CONTRACT_VERSION,
        response_type: responseType,
        status: 'active',
        submitted_at: now,
      };
      const response = existing
        ? await svc.entities.ProviderLeadResponse.update(existing.id, payload)
        : await svc.entities.ProviderLeadResponse.create(payload);

      const duplicates = activeRows.slice(1);
      await Promise.all(duplicates.map((row) => svc.entities.ProviderLeadResponse.update(row.id, {
        status: 'withdrawn',
        withdrawn_at: now,
        withdrawn_by_user_id: user.id,
      })));

      await svc.entities.ProviderLead.update(lead.id, {
        status: providerLeadStatusForResponse(responseType),
        last_response_at: now,
      });

      return res({
        entitlement: access.entitlement,
        response: sanitizeProviderLeadResponse(response),
        lead_status: providerLeadStatusForResponse(responseType),
        contact_access_state: 'hidden',
        conversation_access_state: 'locked',
      });
    } finally {
      await releaseProviderLeadResponseLock(svc, lock);
    }
  } catch (_error) {
    return res({ error: 'Raspunsul nu a putut fi procesat.' }, 500);
  }
});
