import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
  canAccessProviderLeadInbox,
  sanitizeProviderLeadForFreeInbox,
  summarizeProviderLeadInbox,
} from '../../../shared/providerLeadInboxPolicy.js';

const LIST_STATUSES = new Set(['new', 'viewed', 'interested', 'needs_details', 'declined', 'closed', 'expired']);

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

    if (action === 'mark_viewed') {
      const leadId = clean(input.lead_id, 120);
      if (!leadId) return res({ error: 'lead_id este obligatoriu.' }, 400);
      const lead = await svc.entities.ProviderLead.get(leadId).catch(() => null);
      if (!lead || lead.location_id !== locationId) return res({ error: 'Leadul nu a fost gasit.' }, 404);
      if (lead.delivery_state !== 'available') return res({ error: 'Leadul nu mai este disponibil.' }, 409);

      const updated = lead.status === 'new'
        ? await svc.entities.ProviderLead.update(lead.id, { status: 'viewed' })
        : lead;
      return res({
        contract_version: PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
        lead: sanitizeProviderLeadForFreeInbox(updated),
      });
    }

    if (action !== 'list') return res({ error: 'Actiune necunoscuta.' }, 400);

    const requestedStatus = clean(input.status, 80);
    const filter = {
      location_id: locationId,
      delivery_state: 'available',
      ...(LIST_STATUSES.has(requestedStatus) ? { status: requestedStatus } : {}),
    };
    const [rows, allRows] = await Promise.all([
      svc.entities.ProviderLead.filter(filter, '-created_date', boundedLimit(input.limit)),
      svc.entities.ProviderLead.filter({ location_id: locationId, delivery_state: 'available' }, '-created_date', 500),
    ]);

    return res({
      contract_version: PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
      access_tier: 'free_preview',
      contact_access_state: 'hidden',
      conversation_access_state: 'locked',
      location: safeLocation(authorized.location),
      counters: summarizeProviderLeadInbox(allRows),
      leads: rows.map(sanitizeProviderLeadForFreeInbox),
    });
  } catch (_error) {
    return res({ error: 'Leadurile nu au putut fi incarcate.' }, 500);
  }
});
