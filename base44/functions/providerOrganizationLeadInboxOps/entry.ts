import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  loadOrganizationOwnerScopeResolution,
  providerMembershipAccessRole,
} from '../../shared/providerOrganizationOwnerScope.js';
import { resolveProviderEntitlement } from '../../shared/providerEntitlementPolicy.js';
import { projectOrganizationLeadExpirations } from '../../shared/providerOrganizationLeadLifecycle.js';
import {
  PROVIDER_ORGANIZATION_LEAD_INBOX_CONTRACT_VERSION,
  buildOrganizationLeadInboxPage,
  resolveOrganizationLeadLocations,
  safeOrganizationLeadLocation,
} from '../../shared/providerOrganizationLeadInboxPolicy.js';

const ENTITY_PAGE_SIZE = 500;

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

async function readAll(entity, query, sort = '-created_date') {
  const rows = [];
  for (let skip = 0; ; skip += ENTITY_PAGE_SIZE) {
    const page = await entity.filter(query, sort, ENTITY_PAGE_SIZE, skip);
    rows.push(...page);
    if (page.length < ENTITY_PAGE_SIZE) return rows;
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      output[index] = await mapper(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara.' }, 401);

    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list', 40);
    if (action !== 'list') return res({ error: 'Actiune necunoscuta.' }, 400);
    const organizationId = clean(input.organization_id, 120);
    if (!organizationId) return res({ error: 'organization_id este obligatoriu.' }, 400);

    const svc = base44.asServiceRole;
    const memberships = await readAll(svc.entities.ProviderMembership, {
      user_id: user.id,
      status: 'active',
    });
    const hasOwnerMembership = memberships.some((membership) => (
      providerMembershipAccessRole(membership) === 'organization_owner'
      && (!membership.organization_id || membership.organization_id === organizationId)
    ));
    if (!hasOwnerMembership) return res({ error: 'Nu ai acces la inboxul organizatiei.' }, 403);

    const [organizationLocations, ownerScopeResolution] = await Promise.all([
      readAll(svc.entities.ProviderLocation, { organization_id: organizationId }),
      loadOrganizationOwnerScopeResolution(svc, organizationId),
    ]);
    const locations = resolveOrganizationLeadLocations({
      organizationId,
      memberships,
      locations: organizationLocations,
      ownerScopeResolution,
    });
    if (locations.length === 0) return res({ error: 'Nu ai acces la inboxul organizatiei.' }, 403);

    const requestedLocationId = clean(input.location_id, 120);
    if (requestedLocationId && !locations.some((location) => location.id === requestedLocationId)) {
      return res({ error: 'Nu ai acces la leadurile acestei locatii.' }, 403);
    }

    const locationData = await mapWithConcurrency(locations, 4, async (location) => {
      const [leads, subscriptions] = await Promise.all([
        readAll(svc.entities.ProviderLead, { location_id: location.id }),
        readAll(svc.entities.ProviderSubscription, { location_id: location.id }),
      ]);
      return { location, leads, entitlement: resolveProviderEntitlement(subscriptions) };
    });
    const entitlementsByLocation = {};
    for (const item of locationData) entitlementsByLocation[item.location.id] = item.entitlement;

    const projectedLeads = await projectOrganizationLeadExpirations(
      svc, locationData.flatMap((item) => item.leads),
    );
    const page = buildOrganizationLeadInboxPage({
      leads: projectedLeads,
      locations,
      scope: clean(input.scope, 40),
      status: clean(input.status, 80),
      locationId: requestedLocationId,
      offset: input.offset,
      limit: input.limit,
    });
    return res({
      contract_version: PROVIDER_ORGANIZATION_LEAD_INBOX_CONTRACT_VERSION,
      organization_id: organizationId,
      locations: locations.map(safeOrganizationLeadLocation),
      entitlements_by_location: entitlementsByLocation,
      ...page,
    });
  } catch (_error) {
    return res({ error: 'Leadurile organizatiei nu au putut fi incarcate.' }, 500);
  }
});
