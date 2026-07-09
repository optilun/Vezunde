import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.1 Part 3C — Provider direct operating hours update.
// Allowed only for a claimed/approved provider membership.
// Updates ONLY: opening_hours, saturday_hours, availability_status.
// No trust, verification, matching or visibility changes.

const AVAILABILITY_STATUSES = ['astazi', 'urmatoarele_zile', 'saptamana_aceasta', 'doar_programare', 'necunoscuta'];
const MAX_HOURS_LEN = 500;

const LEGACY_PROVIDER_ROLE_MAP = { owner: 'organization_owner', staff: 'location_staff' };
const LEGACY_PROVIDER_STATUS_MAP = { revoked: 'inactive' };
function normalizeProviderMembership(membership) {
  if (!membership) return null;
  const role = LEGACY_PROVIDER_ROLE_MAP[membership.role] || membership.role;
  const status = LEGACY_PROVIDER_STATUS_MAP[membership.status] || membership.status;
  return { ...membership, role, status };
}
function activeProviderMemberships(rows) {
  return (rows || []).map(normalizeProviderMembership).filter((m) => m.status === 'active' && !!m.role);
}
async function getActiveProviderMemberships(svc, userId, options = {}) {
  const query = { user_id: userId, status: 'active' };
  if (options.locationId) query.location_id = options.locationId;
  const rows = await svc.entities.ProviderMembership.filter(query, null, options.limit || 100);
  return activeProviderMemberships(rows);
}
async function getActiveProviderLocationMemberships(svc, userId, locationId) {
  if (!userId || !locationId) return [];
  return getActiveProviderMemberships(svc, userId, { locationId, limit: 10 });
}
async function hasProviderLocationAccess(svc, user, locationId) {
  if (!user || !locationId) return false;
  if (user.role === 'admin') return true;
  const memberships = await getActiveProviderLocationMemberships(svc, user.id, locationId);
  return memberships.length > 0;
}
function getExplicitProviderLocationIds(memberships) {
  return [...new Set((memberships || []).filter((m) => m.status === 'active' && !!m.role).map((m) => m.location_id).filter(Boolean))];
}

async function audit(svc, user, rec) {
  await svc.entities.DirectoryAuditRecord.create({
    entity_type: rec.entity_type,
    entity_id: rec.entity_id || '',
    action_type: rec.action_type,
    changed_fields: rec.changed_fields || [],
    previous_values: JSON.stringify(rec.previous || {}),
    new_values: JSON.stringify(rec.next || {}),
    admin_user_id: user.id,
    admin_email: user.email,
    note: rec.note || '',
    performed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    // Verify active location membership.
    if (!(await hasProviderLocationAccess(svc, user, p.location_id))) {
      return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
    }

    const loc = await svc.entities.ProviderLocation.get(p.location_id).catch(() => null);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });

    // Must be claimed/approved — directory-only locations cannot edit hours.
    if (loc.profile_control_status === 'suspended') {
      return Response.json({ error: 'Profilul este suspendat' }, { status: 403 });
    }
    if (loc.claim_verification_status !== 'approved') {
      return Response.json({ error: 'Locatia trebuie revendicata si aprobata pentru a edita programul' }, { status: 403 });
    }

    // Strict input validation — only the three allowed fields.
    const updates = {};
    if (p.opening_hours !== undefined) {
      const val = String(p.opening_hours || '').trim();
      if (val.length > MAX_HOURS_LEN) return Response.json({ error: 'Programul este prea lung' }, { status: 400 });
      updates.opening_hours = val;
    }
    if (p.saturday_hours !== undefined) {
      const val = String(p.saturday_hours || '').trim();
      if (val.length > MAX_HOURS_LEN) return Response.json({ error: 'Programul de sambata este prea lung' }, { status: 400 });
      updates.saturday_hours = val;
    }
    if (p.availability_status !== undefined) {
      if (!AVAILABILITY_STATUSES.includes(p.availability_status)) {
        return Response.json({ error: 'Status de disponibilitate invalid' }, { status: 400 });
      }
      updates.availability_status = p.availability_status;
      updates.availability_updated_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'Nicio modificare de aplicat' }, { status: 400 });
    }

    // Direct update — operating hours are not staged for admin review.
    await svc.entities.ProviderLocation.update(loc.id, updates);

    await audit(svc, user, {
      entity_type: 'ProviderLocation', entity_id: loc.id,
      action_type: 'update_operating_hours',
      changed_fields: Object.keys(updates),
      previous: {
        opening_hours: loc.opening_hours || '',
        saturday_hours: loc.saturday_hours || '',
        availability_status: loc.availability_status || 'necunoscuta',
      },
      next: updates,
      note: 'Program actualizat de provider',
    });

    return Response.json({ success: true, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});