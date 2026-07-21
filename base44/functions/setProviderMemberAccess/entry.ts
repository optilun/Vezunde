import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  isPrivilegedProviderRole,
  loadOrganizationOwnerScopeResolution,
  membershipHasOrganizationWideAccess,
  providerMembershipAccessRole,
  roleRequiresOrganizationWideAccess,
  storedProviderRoleForAccessRole,
} from '../../../shared/providerOrganizationOwnerScope.js';

const ACCESS_ROLES = [ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, 'location_manager', 'location_staff'];
function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value || '').trim(); }
function normalizeRole(value) {
  if (value === 'owner') return ORGANIZATION_OWNER_ROLE;
  if (value === 'admin') return ORGANIZATION_ADMIN_ROLE;
  if (value === 'manager') return 'location_manager';
  if (value === 'staff') return 'location_staff';
  return ACCESS_ROLES.includes(value) ? value : '';
}

async function audit(svc, user, record) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: record.entity_type,
    entity_id: record.entity_id || '',
    action_type: record.action_type,
    changed_fields: record.changed_fields || [],
    previous_values: JSON.stringify(record.previous || {}),
    new_values: JSON.stringify(record.next || {}),
    admin_user_id: user.id,
    admin_email: user.email || '',
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
}

async function organizationScope(svc, organizationId) {
  const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
  const locationIds = new Set(locations.map((location) => location.id));
  const rows = await svc.entities.ProviderMembership.filter({ organization_id: organizationId }, '-created_date', 1500);
  const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
  return {
    locations,
    locationIds,
    resolution,
    rows: rows.filter((row) => row.organization_id === organizationId || locationIds.has(row.location_id)),
  };
}

function targetRole(rows, userId) {
  const roles = rows.filter((row) => row.user_id === userId && row.status === 'active').map(providerMembershipAccessRole);
  if (roles.includes(ORGANIZATION_OWNER_ROLE)) return ORGANIZATION_OWNER_ROLE;
  if (roles.includes(ORGANIZATION_ADMIN_ROLE)) return ORGANIZATION_ADMIN_ROLE;
  if (roles.includes('location_manager')) return 'location_manager';
  if (roles.includes('location_staff')) return 'location_staff';
  return '';
}

function targetHasWideAccess(rows, userId, resolution) {
  return rows.some((row) => row.user_id === userId && membershipHasOrganizationWideAccess(row, resolution));
}

function actorScope(rows, userId, locations, resolution) {
  const ownRows = rows.filter((row) => row.user_id === userId && row.status === 'active');
  const ownerLocationIds = new Set();
  const adminLocationIds = new Set();
  let wideOwner = false;
  let organizationAdmin = false;
  for (const row of ownRows) {
    const accessRole = providerMembershipAccessRole(row);
    if (accessRole === ORGANIZATION_OWNER_ROLE) {
      if (row.location_id) ownerLocationIds.add(row.location_id);
      if (membershipHasOrganizationWideAccess(row, resolution)) wideOwner = true;
    }
    if (accessRole === ORGANIZATION_ADMIN_ROLE && row.organization_wide_access === true) organizationAdmin = true;
  }
  if (wideOwner) for (const location of locations) ownerLocationIds.add(location.id);
  if (organizationAdmin) for (const location of locations) adminLocationIds.add(location.id);
  return {
    role: wideOwner || ownerLocationIds.size > 0 ? ORGANIZATION_OWNER_ROLE : (organizationAdmin ? ORGANIZATION_ADMIN_ROLE : ''),
    wideOwner,
    organizationAdmin,
    ownerLocationIds,
    adminLocationIds,
    manageableLocationIds: new Set([...ownerLocationIds, ...adminLocationIds]),
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return res({ error: 'Autentificare necesara' }, 401);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const targetUserId = clean(payload.user_id);
    const organizationId = clean(payload.organization_id);
    const assignments = Array.isArray(payload.assignments) ? payload.assignments : [];
    const requestedWideAccess = payload.organization_wide_access === true;
    if (!targetUserId || !organizationId) return res({ error: 'user_id si organization_id sunt obligatorii' }, 400);

    const scope = await organizationScope(svc, organizationId);
    const actor = user.role === 'admin'
      ? { role: 'platform_admin', wideOwner: true, organizationAdmin: false, ownerLocationIds: scope.locationIds, adminLocationIds: new Set(), manageableLocationIds: scope.locationIds }
      : actorScope(scope.rows, user.id, scope.locations, scope.resolution);
    if (!['platform_admin', ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE].includes(actor.role)) {
      return res({ error: 'Nu ai dreptul sa modifici accesul utilizatorilor' }, 403);
    }

    const currentTargetRole = targetRole(scope.rows, targetUserId);
    const currentTargetWide = targetHasWideAccess(scope.rows, targetUserId, scope.resolution);
    if (actor.role === ORGANIZATION_ADMIN_ROLE && isPrivilegedProviderRole(currentTargetRole)) {
      return res({ error: 'Administratorul organizatiei nu poate modifica owneri sau alti administratori' }, 403);
    }
    if (actor.role === ORGANIZATION_ADMIN_ROLE && targetUserId === user.id) {
      return res({ error: 'Nu iti poti modifica propriul acces organizational' }, 403);
    }
    if (currentTargetWide && currentTargetRole === ORGANIZATION_OWNER_ROLE && !actor.wideOwner && actor.role !== 'platform_admin') {
      return res({ error: 'Doar un owner cu acces la intreaga organizatie poate modifica un owner global' }, 403);
    }

    const normalized = [];
    const seen = new Set();
    let selectedRole = '';
    for (const assignment of assignments) {
      const locationId = clean(assignment?.location_id);
      const accessRole = normalizeRole(assignment?.role);
      if (!locationId || !accessRole || seen.has(locationId)) return res({ error: 'Configuratie de acces invalida' }, 400);
      if (!scope.locationIds.has(locationId)) return res({ error: 'Locatie invalida sau din alta organizatie' }, 403);
      if (selectedRole && selectedRole !== accessRole) return res({ error: 'Un utilizator trebuie sa aiba un singur rol clar in organizatie' }, 400);
      selectedRole = accessRole;
      seen.add(locationId);
      normalized.push({ location_id: locationId, role: accessRole });
    }

    const requiresWide = roleRequiresOrganizationWideAccess(selectedRole);
    const organizationWide = requiresWide || (selectedRole === ORGANIZATION_OWNER_ROLE && requestedWideAccess);
    if (requiresWide && !requestedWideAccess) return res({ error: 'Administratorul organizatiei trebuie sa primeasca toate locatiile actuale si viitoare' }, 400);
    if (organizationWide) {
      if (!actor.wideOwner && actor.role !== 'platform_admin') return res({ error: 'Doar un owner global poate acorda acces la intreaga organizatie' }, 403);
      const coversAll = scope.locations.length > 0 && scope.locations.every((location) => seen.has(location.id));
      if (!coversAll) return res({ error: 'Accesul organizational trebuie aplicat tuturor locatiilor actuale' }, 400);
    }

    if (selectedRole === ORGANIZATION_OWNER_ROLE && !organizationWide) {
      if (![ORGANIZATION_OWNER_ROLE, 'platform_admin'].includes(actor.role)) return res({ error: 'Numai ownerul poate acorda rol de owner' }, 403);
      if (actor.role !== 'platform_admin' && !normalized.every((assignment) => actor.ownerLocationIds.has(assignment.location_id))) {
        return res({ error: 'Poti acorda rol de owner numai pentru locatiile pe care le detii' }, 403);
      }
    } else if (selectedRole && !isPrivilegedProviderRole(selectedRole)) {
      if (actor.role !== 'platform_admin' && !normalized.every((assignment) => actor.manageableLocationIds.has(assignment.location_id))) {
        return res({ error: 'Nu poti acorda acces pentru aceste locatii' }, 403);
      }
    } else if (selectedRole === ORGANIZATION_ADMIN_ROLE && actor.role !== 'platform_admin' && !actor.wideOwner) {
      return res({ error: 'Numai ownerul global poate acorda rol de administrator' }, 403);
    }

    const targetRows = scope.rows.filter((row) => row.user_id === targetUserId);
    const resultingOwnerLocationIds = new Set(selectedRole === ORGANIZATION_OWNER_ROLE ? normalized.map((assignment) => assignment.location_id) : []);
    for (const location of scope.locations) {
      const currentOwners = new Set(scope.rows
        .filter((row) => row.location_id === location.id && row.status === 'active' && providerMembershipAccessRole(row) === ORGANIZATION_OWNER_ROLE)
        .map((row) => row.user_id));
      if (currentOwners.has(targetUserId) && currentOwners.size === 1 && !resultingOwnerLocationIds.has(location.id)) {
        return res({ error: `Nu poti elimina ultimul owner activ al locatiei ${location.public_display_name || location.name || ''}`.trim() }, 400);
      }
    }
    if (targetUserId === user.id && normalized.length === 0) return res({ error: 'Nu iti poti elimina propriul acces' }, 403);

    const currentByLocation = new Map();
    for (const row of targetRows) if (row.location_id && !currentByLocation.has(row.location_id)) currentByLocation.set(row.location_id, row);
    const now = new Date().toISOString();
    const previous = targetRows.map((row) => ({
      location_id: row.location_id,
      role: providerMembershipAccessRole(row),
      status: row.status,
      organization_wide_access: membershipHasOrganizationWideAccess(row, scope.resolution),
    }));

    for (const assignment of normalized) {
      const existing = currentByLocation.get(assignment.location_id);
      const updates = {
        role: storedProviderRoleForAccessRole(assignment.role),
        organization_role: assignment.role === ORGANIZATION_ADMIN_ROLE ? ORGANIZATION_ADMIN_ROLE : 'none',
        status: 'active',
        organization_id: organizationId,
        organization_wide_access: organizationWide,
        claim_scope: organizationWide ? 'organization' : (normalized.length > 1 ? 'selected_locations' : 'location'),
        access_origin: existing?.access_origin || 'admin',
      };
      if (existing) {
        const nextUpdates = existing.status !== 'active'
          ? { ...updates, reactivated_by_user_id: user.id, reactivated_at: now }
          : updates;
        await svc.entities.ProviderMembership.update(existing.id, nextUpdates);
      } else {
        await svc.entities.ProviderMembership.create({ user_id: targetUserId, location_id: assignment.location_id, ...updates });
      }
    }

    const selectedIds = new Set(normalized.map((assignment) => assignment.location_id));
    for (const row of targetRows) {
      if (!row.location_id || selectedIds.has(row.location_id) || row.status !== 'active') continue;
      await svc.entities.ProviderMembership.update(row.id, {
        status: 'inactive',
        organization_wide_access: false,
        deactivated_by_user_id: user.id,
        deactivated_at: now,
      });
    }

    const next = normalized.map((assignment) => ({ ...assignment, status: 'active', organization_wide_access: organizationWide }));
    await audit(svc, user, {
      entity_type: 'ProviderMembership',
      entity_id: targetUserId,
      action_type: 'set_provider_member_access',
      changed_fields: ['role', 'organization_role', 'status', 'location_id', 'organization_wide_access'],
      previous,
      next,
      note: `Acces actualizat de ${actor.role} pentru utilizator in organizatia ${organizationId}`,
    });

    return res({ success: true, assignments: next, actor_role: actor.role, organization_wide_access: organizationWide });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
