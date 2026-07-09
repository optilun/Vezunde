import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.3 — Fast-path provider routine updates.
// Immediate, audited provider-scoped updates after approved claim + active
// membership. This function never changes trust, verification, matching,
// visibility, ranking, locality, address, provider type, organization identity,
// claim state or membership.

const ROUTINE_FIELDS = [
  'opening_hours_json',
  'opening_hours',
  'saturday_hours',
  'availability_status',
  'request_intake_status',
];
const INPUT_FIELDS = ['location_id', ...ROUTINE_FIELDS];
const AVAILABILITY_STATUSES = ['astazi', 'urmatoarele_zile', 'saptamana_aceasta', 'doar_programare', 'necunoscuta'];
const REQUEST_INTAKE_STATUSES = ['inactive', 'active', 'paused'];
const MAX_HOURS_LEN = 500;
const MAX_SCHEDULE_JSON_LEN = 8000;
const MAX_URL_LEN = 500;
const MAX_CONTACT_LEN = 200;

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

function reject(error, status = 400) {
  return Response.json({ error }, { status });
}

function cleanPlainText(value, field, maxLen) {
  const val = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (val.length > maxLen) return { error: `${field} depaseste lungimea maxima` };
  if (/[<>]/.test(val) || /<\/?[a-z][\s\S]*>/i.test(val)) return { error: `${field} trebuie sa fie text simplu, fara HTML` };
  if (/\b(?:script|iframe|embed|object)\b/i.test(val)) return { error: `${field} contine continut nesigur` };
  return { value: val };
}

function cleanUrl(value, field) {
  const val = String(value || '').trim();
  if (!val) return { value: '' };
  if (val.length > MAX_URL_LEN) return { error: `${field} depaseste lungimea maxima` };
  let parsed;
  try { parsed = new URL(val); } catch (_e) { return { error: `${field} trebuie sa fie URL valid` }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { error: `${field} trebuie sa foloseasca http sau https` };
  if (/\b(?:javascript|data|vbscript|file):/i.test(val)) return { error: `${field} contine protocol nesigur` };
  return { value: parsed.toString() };
}

function cleanEmail(value) {
  const val = String(value || '').trim();
  if (!val) return { value: '' };
  if (val.length > MAX_CONTACT_LEN) return { error: 'Emailul public este prea lung' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return { error: 'Email public invalid' };
  return { value: val };
}

function cleanPhone(value) {
  const val = String(value || '').trim();
  if (val.length > 80) return { error: 'Telefonul public este prea lung' };
  if (val && !/^[0-9+().\-\s]{6,80}$/.test(val)) return { error: 'Telefon public invalid' };
  return { value: val };
}

function cleanPayload(p) {
  const keys = Object.keys(p).filter((k) => k !== 'action');
  const unknown = keys.filter((k) => !INPUT_FIELDS.includes(k));
  if (unknown.length > 0) return { error: 'Camp nepermis', fields: unknown };
  const updates = {};

  if ('opening_hours_json' in p) {
    const val = String(p.opening_hours_json || '').trim();
    if (val.length > MAX_SCHEDULE_JSON_LEN) return { error: 'Programul structurat este prea lung' };
    if (val) {
      try { JSON.parse(val); } catch (_e) { return { error: 'opening_hours_json trebuie sa fie JSON valid' }; }
    }
    updates.opening_hours_json = val;
  }
  for (const field of ['opening_hours', 'saturday_hours']) {
    if (field in p) {
      const cleaned = cleanPlainText(p[field], field, MAX_HOURS_LEN);
      if (cleaned.error) return cleaned;
      updates[field] = cleaned.value;
    }
  }
  if ('availability_status' in p) {
    if (!AVAILABILITY_STATUSES.includes(p.availability_status)) return { error: 'Status de disponibilitate invalid' };
    updates.availability_status = p.availability_status;
    updates.availability_updated_at = new Date().toISOString();
  }
  if ('request_intake_status' in p) {
    if (!REQUEST_INTAKE_STATUSES.includes(p.request_intake_status)) return { error: 'Mod acces pacient invalid' };
    updates.request_intake_status = p.request_intake_status;
  }

  if (Object.keys(updates).length === 0) return { error: 'Nicio modificare de aplicat' };
  return { updates };
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
    if (!user) return reject('Autentificare necesara', 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    const locationId = String(p.location_id || '').trim();
    if (!locationId) return reject('location_id este obligatoriu');

    if (!(await hasProviderLocationAccess(svc, user, locationId))) return reject('Nu ai acces la aceasta locatie', 403);

    const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!loc) return reject('Locatia nu a fost gasita', 404);
    if ((loc.profile_control_status || '') === 'suspended' || loc.status === 'suspendata') return reject('Profilul este suspendat', 403);
    if (loc.claim_verification_status !== 'approved') {
      return reject('Update-urile rapide sunt disponibile doar dupa aprobarea revendicarii', 403);
    }

    const cleaned = cleanPayload(p);
    if (cleaned.error) return Response.json({ error: cleaned.error, fields: cleaned.fields || [] }, { status: 400 });
    const updates = cleaned.updates;

    const previous = {};
    for (const key of Object.keys(updates)) previous[key] = loc[key];
    await svc.entities.ProviderLocation.update(loc.id, updates);
    await audit(svc, user, {
      entity_type: 'ProviderLocation',
      entity_id: loc.id,
      action_type: 'provider_fast_path_routine_update',
      changed_fields: Object.keys(updates),
      previous,
      next: updates,
      note: 'Update administrativ rapid aplicat de provider dupa revendicare aprobata',
    });

    const publicUpdates = Object.fromEntries(Object.entries(updates).filter(([key]) => ROUTINE_FIELDS.includes(key) || key === 'availability_updated_at'));
    return Response.json({ success: true, updates: publicUpdates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});