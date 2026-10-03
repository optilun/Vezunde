import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  loadOrganizationOwnerScopeResolution,
  membershipHasOrganizationWideAccess,
  providerMembershipAccessRole,
  storedProviderRoleForAccessRole,
} from '../../shared/providerOrganizationOwnerScope.js';
import {
  PROVIDER_MANAGER_ROLE,
  canAssignProviderRole,
  canManageProviderMember,
  highestProviderAccessRole,
  providerRoleCoversOrganization,
} from '../../shared/providerRolePolicy.js';

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
function uniqueRows(rows) {
  const byId = new Map();
  for (const row of rows) {
    const key = row?.id || `${row?.user_id || ''}:${row?.location_id || ''}:${row?.created_date || ''}`;
    if (key) byId.set(key, row);
  }
  return [...byId.values()];
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
  const collected = await svc.entities.ProviderMembership.filter({ organization_id: organizationId }, '-created_date', 1500).catch(() => []);
  for (const location of locations) {
    const locationRows = await svc.entities.ProviderMembership.filter({ location_id: location.id }, '-created_date', 500).catch(() => []);
    collected.push(...locationRows);
  }
  const resolution = await loadOrganizationOwnerScopeResolution(svc, organizationId);
  return {
    locations,
    locationIds,
    resolution,
    rows: uniqueRows(collected).filter((row) => row.organization_id === organizationId || locationIds.has(row.location_id)),
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

// 2026-10-03 (structura conturilor, pasul 3). Rolul actorului dupa matricea comuna
// (shared/providerRolePolicy.js): proprietarul si administratorul in toata organizatia, managerul
// doar la locatiile lui. Un rand vechi de proprietar limitat la anumite locatii conteaza ca manager
// pe acele locatii (nu mai exista azi si nu mai poate fi creat).
function actorScope(rows, userId, locations, resolution) {
  const ownRows = rows.filter((row) => row.user_id === userId && row.status === 'active');
  const managerLocationIds = new Set();
  let role = '';
  let wideOwner = false;
  let organizationAdmin = false;
  for (const row of ownRows) {
    let accessRole = providerMembershipAccessRole(row);
    if (accessRole === ORGANIZATION_OWNER_ROLE) {
      if (membershipHasOrganizationWideAccess(row, resolution)) wideOwner = true;
      else accessRole = PROVIDER_MANAGER_ROLE;
    }
    if (accessRole === ORGANIZATION_ADMIN_ROLE) organizationAdmin = true;
    if (accessRole === PROVIDER_MANAGER_ROLE && row.location_id) managerLocationIds.add(row.location_id);
    if ([ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE, PROVIDER_MANAGER_ROLE].includes(accessRole)) role = highestProviderAccessRole([role, accessRole]);
  }
  const allLocationIds = new Set(locations.map((location) => location.id));
  return {
    role,
    wideOwner,
    organizationAdmin,
    ownerLocationIds: wideOwner ? allLocationIds : new Set(),
    manageableLocationIds: providerRoleCoversOrganization(role) ? allLocationIds : managerLocationIds,
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
    if (!targetUserId || !organizationId) return res({ error: 'user_id si organization_id sunt obligatorii' }, 400);

    const scope = await organizationScope(svc, organizationId);
    const actor = user.role === 'admin'
      ? { role: 'platform_admin', wideOwner: true, organizationAdmin: false, ownerLocationIds: scope.locationIds, manageableLocationIds: scope.locationIds }
      : actorScope(scope.rows, user.id, scope.locations, scope.resolution);
    if (!canManageProviderMember(actor.role, '')) {
      return res({ error: 'Nu ai dreptul sa modifici accesul utilizatorilor' }, 403);
    }

    const actorCanManageAllLocations = actor.role === 'platform_admin' || providerRoleCoversOrganization(actor.role);
    const mutableLocationIds = actorCanManageAllLocations ? scope.locationIds : actor.manageableLocationIds;
    const currentTargetRole = targetRole(scope.rows, targetUserId);
    // Cine poate schimba accesul cuiva: doar cine i-ar putea da rolul pe care il are acum.
    if (!canManageProviderMember(actor.role, currentTargetRole)) {
      return res({
        error: actor.role === ORGANIZATION_ADMIN_ROLE
          ? 'Administratorul organizatiei nu poate modifica proprietari sau alti administratori'
          : (actor.role === PROVIDER_MANAGER_ROLE ? 'Managerul locatiei poate modifica doar accesul membrilor' : 'Nu poti modifica accesul acestui utilizator'),
      }, 403);
    }
    if (actor.role !== 'platform_admin' && actor.role !== ORGANIZATION_OWNER_ROLE && targetUserId === user.id) {
      return res({ error: 'Nu iti poti modifica propriul acces organizational' }, 403);
    }

    const normalized = [];
    const seen = new Set();
    let selectedRole = '';
    for (const assignment of assignments) {
      const locationId = clean(assignment?.location_id);
      const accessRole = normalizeRole(assignment?.role);
      if (!locationId || !accessRole || seen.has(locationId)) return res({ error: 'Configuratie de acces invalida' }, 400);
      if (!scope.locationIds.has(locationId)) return res({ error: 'Locatie invalida sau din alta organizatie' }, 403);
      if (!mutableLocationIds.has(locationId)) return res({ error: 'Nu poti modifica accesul pentru aceasta locatie' }, 403);
      if (selectedRole && selectedRole !== accessRole) return res({ error: 'Un utilizator trebuie sa aiba un singur rol clar in organizatie' }, 400);
      selectedRole = accessRole;
      seen.add(locationId);
      normalized.push({ location_id: locationId, role: accessRole });
    }
    if (selectedRole && !canAssignProviderRole(actor.role, selectedRole)) {
      return res({
        error: actor.role === PROVIDER_MANAGER_ROLE
          ? 'Managerul locatiei poate acorda doar rolul de membru'
          : 'Doar proprietarul organizatiei poate acorda rolul de proprietar sau administrator',
      }, 403);
    }
    // 2026-10-03 (pasul 3): fara „owner selectiv”. Proprietarul si administratorul primesc mereu
    // toate locatiile organizatiei (si pe cele viitoare), oricare ar fi lista trimisa.
    const organizationWide = providerRoleCoversOrganization(selectedRole);
    if (organizationWide) {
      normalized.length = 0;
      seen.clear();
      for (const location of scope.locations) {
        seen.add(location.id);
        normalized.push({ location_id: location.id, role: selectedRole });
      }
    }

    const targetRows = scope.rows.filter((row) => row.user_id === targetUserId);
    const activeOutsideScopeRows = targetRows.filter((row) => row.status === 'active' && row.location_id && !mutableLocationIds.has(row.location_id));
    const outsideRoles = [...new Set(activeOutsideScopeRows.map(providerMembershipAccessRole).filter(Boolean))];
    if (!actorCanManageAllLocations && selectedRole && outsideRoles.some((outsideRole) => outsideRole !== selectedRole)) {
      return res({ error: 'Utilizatorul are un alt rol in locatii din afara accesului tau. Modificarea trebuie facuta de proprietarul sau administratorul organizatiei.' }, 409);
    }
    if (!actorCanManageAllLocations && activeOutsideScopeRows.some((row) => membershipHasOrganizationWideAccess(row, scope.resolution))) {
      return res({ error: 'Accesul utilizatorului la toata organizatia poate fi modificat numai de proprietar.' }, 403);
    }

    if (organizationWide && scope.locations.length === 0) {
      return res({ error: 'Organizatia nu are locatii' }, 400);
    }
    if (selectedRole && !organizationWide && actor.role !== 'platform_admin'
      && !normalized.every((assignment) => actor.manageableLocationIds.has(assignment.location_id))) {
      return res({ error: 'Nu poti acorda acces pentru aceste locatii' }, 403);
    }

    const preservedOwnerLocationIds = new Set(activeOutsideScopeRows
      .filter((row) => providerMembershipAccessRole(row) === ORGANIZATION_OWNER_ROLE)
      .map((row) => row.location_id));
    const resultingOwnerLocationIds = new Set([
      ...preservedOwnerLocationIds,
      ...(selectedRole === ORGANIZATION_OWNER_ROLE ? normalized.map((assignment) => assignment.location_id) : []),
    ]);
    for (const location of scope.locations) {
      if (!mutableLocationIds.has(location.id)) continue;
      const currentOwners = new Set(scope.rows
        .filter((row) => row.location_id === location.id && row.status === 'active' && providerMembershipAccessRole(row) === ORGANIZATION_OWNER_ROLE)
        .map((row) => row.user_id));
      if (currentOwners.has(targetUserId) && currentOwners.size === 1 && !resultingOwnerLocationIds.has(location.id)) {
        return res({ error: `Nu poti elimina ultimul proprietar activ al locatiei ${location.public_display_name || location.name || ''}`.trim() }, 400);
      }
    }
    if (targetUserId === user.id && normalized.length === 0 && activeOutsideScopeRows.length === 0) {
      return res({ error: 'Nu iti poti elimina propriul acces' }, 403);
    }

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
      if (!row.location_id || !mutableLocationIds.has(row.location_id) || selectedIds.has(row.location_id) || row.status !== 'active') continue;
      await svc.entities.ProviderMembership.update(row.id, {
        status: 'inactive',
        organization_wide_access: false,
        deactivated_by_user_id: user.id,
        deactivated_at: now,
      });
    }

    const next = [
      ...activeOutsideScopeRows.map((row) => ({
        location_id: row.location_id,
        role: providerMembershipAccessRole(row),
        status: 'active',
        organization_wide_access: membershipHasOrganizationWideAccess(row, scope.resolution),
        preserved_outside_actor_scope: true,
      })),
      ...normalized.map((assignment) => ({ ...assignment, status: 'active', organization_wide_access: organizationWide })),
    ];
    await audit(svc, user, {
      entity_type: 'ProviderMembership',
      entity_id: targetUserId,
      action_type: 'set_provider_member_access',
      changed_fields: ['role', 'organization_role', 'status', 'location_id', 'organization_wide_access'],
      previous,
      next,
      note: `Acces actualizat de ${actor.role} pentru utilizator in organizatia ${organizationId}. Randurile din afara scope-ului actorului au fost pastrate.`,
    });

    return res({
      success: true,
      assignments: next,
      actor_role: actor.role,
      organization_wide_access: organizationWide,
      preserved_outside_scope_count: activeOutsideScopeRows.length,
    });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
