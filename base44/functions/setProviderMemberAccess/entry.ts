import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  ORGANIZATION_ADMIN_ROLE,
  ORGANIZATION_OWNER_ROLE,
  isOrganizationWideProviderRole,
  providerMembershipAccessRole,
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
function unique(values) { return [...new Set(values.filter(Boolean))]; }

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

async function organizationMemberships(svc, organizationId) {
  const locations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
  const locationIds = new Set(locations.map((location) => location.id));
  const rows = await svc.entities.ProviderMembership.filter({ organization_id: organizationId }, '-created_date', 1500);
  return { locations, locationIds, rows: rows.filter((row) => row.organization_id === organizationId || locationIds.has(row.location_id)) };
}

function actorAccessRole(rows, userId) {
  const roles = rows
    .filter((row) => row.user_id === userId && row.status === 'active')
    .map(providerMembershipAccessRole);
  if (roles.includes(ORGANIZATION_OWNER_ROLE)) return ORGANIZATION_OWNER_ROLE;
  if (roles.includes(ORGANIZATION_ADMIN_ROLE)) return ORGANIZATION_ADMIN_ROLE;
  return '';
}

function highestTargetRole(rows, userId) {
  const roles = rows
    .filter((row) => row.user_id === userId && row.status === 'active')
    .map(providerMembershipAccessRole);
  if (roles.includes(ORGANIZATION_OWNER_ROLE)) return ORGANIZATION_OWNER_ROLE;
  if (roles.includes(ORGANIZATION_ADMIN_ROLE)) return ORGANIZATION_ADMIN_ROLE;
  if (roles.includes('location_manager')) return 'location_manager';
  if (roles.includes('location_staff')) return 'location_staff';
  return '';
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

    const scope = await organizationMemberships(svc, organizationId);
    const actorRole = user.role === 'admin' ? 'platform_admin' : actorAccessRole(scope.rows, user.id);
    if (!['platform_admin', ORGANIZATION_OWNER_ROLE, ORGANIZATION_ADMIN_ROLE].includes(actorRole)) {
      return res({ error: 'Nu ai dreptul sa modifici accesul utilizatorilor' }, 403);
    }

    const targetCurrentRole = highestTargetRole(scope.rows, targetUserId);
    if (actorRole === ORGANIZATION_ADMIN_ROLE && isOrganizationWideProviderRole(targetCurrentRole)) {
      return res({ error: 'Administratorul organizatiei nu poate modifica owneri sau alti administratori' }, 403);
    }
    if (actorRole === ORGANIZATION_ADMIN_ROLE && targetUserId === user.id) {
      return res({ error: 'Nu iti poti modifica propriul acces organizational' }, 403);
    }

    const normalized = [];
    const seen = new Set();
    for (const assignment of assignments) {
      const locationId = clean(assignment?.location_id);
      const accessRole = normalizeRole(assignment?.role);
      if (!locationId || !accessRole || seen.has(locationId)) return res({ error: 'Configuratie de acces invalida' }, 400);
      if (!scope.locationIds.has(locationId)) return res({ error: 'Locatie invalida sau din alta organizatie' }, 403);
      if (actorRole === ORGANIZATION_ADMIN_ROLE && isOrganizationWideProviderRole(accessRole)) {
        return res({ error: 'Numai ownerul poate acorda rol de owner sau administrator' }, 403);
      }
      seen.add(locationId);
      normalized.push({ location_id: locationId, role: accessRole });
    }

    const privilegedRole = normalized.find((assignment) => isOrganizationWideProviderRole(assignment.role))?.role || '';
    if (privilegedRole) {
      if (![ORGANIZATION_OWNER_ROLE, 'platform_admin'].includes(actorRole)) {
        return res({ error: 'Numai ownerul poate acorda roluri organizationale' }, 403);
      }
      const coversAllLocations = scope.locations.length > 0
        && scope.locations.every((location) => normalized.some((assignment) => assignment.location_id === location.id && assignment.role === privilegedRole));
      const onlySameRole = normalized.every((assignment) => assignment.role === privilegedRole);
      if (!coversAllLocations || !onlySameRole) return res({ error: 'Rolul organizational trebuie aplicat tuturor locatiilor actuale' }, 400);
    }

    const targetRows = scope.rows.filter((row) => row.user_id === targetUserId);
    const activeOwnerUsers = new Set(scope.rows
      .filter((row) => row.status === 'active' && providerMembershipAccessRole(row) === ORGANIZATION_OWNER_ROLE)
      .map((row) => row.user_id));
    const targetIsOwner = activeOwnerUsers.has(targetUserId);
    const targetRemainsOwner = privilegedRole === ORGANIZATION_OWNER_ROLE;
    if (targetIsOwner && !targetRemainsOwner && activeOwnerUsers.size <= 1) {
      return res({ error: 'Nu poti elimina ultimul owner activ al organizatiei' }, 400);
    }
    if (targetUserId === user.id && normalized.length === 0) return res({ error: 'Nu iti poti elimina propriul acces' }, 403);

    const currentByLocation = new Map();
    for (const row of targetRows) if (row.location_id && !currentByLocation.has(row.location_id)) currentByLocation.set(row.location_id, row);
    const now = new Date().toISOString();
    const previous = targetRows.map((row) => ({
      location_id: row.location_id,
      role: providerMembershipAccessRole(row),
      status: row.status,
      organization_wide_access: row.organization_wide_access === true,
    }));

    for (const assignment of normalized) {
      const existing = currentByLocation.get(assignment.location_id);
      const organizationWide = isOrganizationWideProviderRole(assignment.role);
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
        if (existing.status !== 'active') {
          updates.reactivated_by_user_id = user.id;
          updates.reactivated_at = now;
        }
        await svc.entities.ProviderMembership.update(existing.id, updates);
      } else {
        await svc.entities.ProviderMembership.create({
          user_id: targetUserId,
          location_id: assignment.location_id,
          ...updates,
        });
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

    const next = normalized.map((assignment) => ({
      ...assignment,
      status: 'active',
      organization_wide_access: isOrganizationWideProviderRole(assignment.role),
    }));
    await audit(svc, user, {
      entity_type: 'ProviderMembership',
      entity_id: targetUserId,
      action_type: 'set_provider_member_access',
      changed_fields: unique(['role', 'organization_role', 'status', 'location_id', 'organization_wide_access']),
      previous,
      next,
      note: `Acces actualizat de ${actorRole} pentru utilizator in organizatia ${organizationId}`,
    });

    return res({ success: true, assignments: next, actor_role: actorRole });
  } catch (error) {
    return res({ error: error?.message || 'Eroare neasteptata' }, 500);
  }
});
