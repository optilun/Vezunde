import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function res(body, status = 200) { return Response.json(body, { status }); }
function clean(value) { return String(value || '').trim(); }
function normalizeRole(value) {
  if (value === 'owner') return 'organization_owner';
  if (value === 'staff') return 'location_staff';
  return ROLES.includes(value) ? value : '';
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
    admin_email: user.email,
    note: record.note || '',
    performed_at: new Date().toISOString(),
  });
}

async function ownerOrganizations(svc, userId) {
  const rows = await svc.entities.ProviderMembership.filter({ user_id: userId, status: 'active' }, '-created_date', 500);
  return new Set(rows.filter((row) => normalizeRole(row.role) === 'organization_owner' && row.organization_id).map((row) => row.organization_id));
}

async function activeOwnerUsers(svc, organizationId) {
  const rows = await svc.entities.ProviderMembership.filter({ organization_id: organizationId, status: 'active' }, '-created_date', 1000);
  return new Set(rows.filter((row) => normalizeRole(row.role) === 'organization_owner').map((row) => row.user_id));
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

    const ownedOrganizations = await ownerOrganizations(svc, user.id);
    if (!ownedOrganizations.has(organizationId) && user.role !== 'admin') return res({ error: 'Doar ownerul organizatiei poate modifica accesul utilizatorilor' }, 403);

    const organizationLocations = await svc.entities.ProviderLocation.filter({ organization_id: organizationId }, '-created_date', 500);
    const organizationLocationIds = new Set(organizationLocations.map((location) => location.id));
    const normalized = [];
    const seen = new Set();
    for (const assignment of assignments) {
      const locationId = clean(assignment?.location_id);
      const assignmentRole = normalizeRole(assignment?.role);
      if (!locationId || !assignmentRole || seen.has(locationId)) return res({ error: 'Configuratie de acces invalida' }, 400);
      if (!organizationLocationIds.has(locationId)) return res({ error: 'Locatie invalida sau din alta organizatie' }, 403);
      seen.add(locationId);
      normalized.push({ location_id: locationId, role: assignmentRole });
    }

    const hasOwnerRole = normalized.some((assignment) => assignment.role === 'organization_owner');
    if (hasOwnerRole) {
      const coversAllLocations = organizationLocations.length > 0
        && organizationLocations.every((location) => normalized.some((assignment) => assignment.location_id === location.id && assignment.role === 'organization_owner'));
      const onlyOwnerRoles = normalized.every((assignment) => assignment.role === 'organization_owner');
      if (!coversAllLocations || !onlyOwnerRoles) return res({ error: 'Ownerul organizatiei trebuie sa aiba rol de owner in toate locatiile actuale' }, 400);
    }

    const currentRows = await svc.entities.ProviderMembership.filter({ user_id: targetUserId }, '-created_date', 1000);
    const organizationRows = currentRows.filter((row) => row.organization_id === organizationId || organizationLocationIds.has(row.location_id));
    const currentByLocation = new Map();
    for (const row of organizationRows) if (row.location_id && !currentByLocation.has(row.location_id)) currentByLocation.set(row.location_id, row);

    const activeOwners = await activeOwnerUsers(svc, organizationId);
    const targetIsOwner = activeOwners.has(targetUserId);
    const targetRemainsOwner = normalized.some((assignment) => assignment.role === 'organization_owner');
    if (targetIsOwner && !targetRemainsOwner && activeOwners.size <= 1) return res({ error: 'Nu poti elimina ultimul owner activ al organizatiei' }, 400);
    if (targetUserId === user.id && normalized.length === 0) return res({ error: 'Nu iti poti elimina propriul acces' }, 403);

    const now = new Date().toISOString();
    const previous = organizationRows.map((row) => ({ location_id: row.location_id, role: normalizeRole(row.role), status: row.status }));

    for (const assignment of normalized) {
      const existing = currentByLocation.get(assignment.location_id);
      if (existing) {
        const updates: Record<string, unknown> = {
          role: assignment.role,
          status: 'active',
          organization_id: organizationId,
        };
        if (existing.status !== 'active') {
          updates.reactivated_by_user_id = user.id;
          updates.reactivated_at = now;
        }
        await svc.entities.ProviderMembership.update(existing.id, updates);
      } else {
        await svc.entities.ProviderMembership.create({
          user_id: targetUserId,
          organization_id: organizationId,
          location_id: assignment.location_id,
          role: assignment.role,
          status: 'active',
        });
      }
    }

    const selectedIds = new Set(normalized.map((assignment) => assignment.location_id));
    for (const row of organizationRows) {
      if (!row.location_id || selectedIds.has(row.location_id) || row.status !== 'active') continue;
      await svc.entities.ProviderMembership.update(row.id, {
        status: 'inactive',
        deactivated_by_user_id: user.id,
        deactivated_at: now,
      });
    }

    const next = normalized.map((assignment) => ({ ...assignment, status: 'active' }));
    await audit(svc, user, {
      entity_type: 'ProviderMembership',
      entity_id: targetUserId,
      action_type: 'set_provider_member_access',
      changed_fields: unique(['role', 'status', 'location_id']),
      previous,
      next,
      note: `Acces actualizat pentru utilizator in organizatia ${organizationId}`,
    });

    return res({ success: true, assignments: next });
  } catch (error) {
    return res({ error: error.message }, 500);
  }
});