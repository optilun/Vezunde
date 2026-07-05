import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// MODULE 3H.1C.3 — Fast-path provider routine updates.
// Immediate, audited provider-scoped updates after approved claim + active
// membership. This function never changes trust, verification, matching,
// visibility, ranking, locality, address, provider type, organization identity,
// claim state or membership.

const ROUTINE_FIELDS = [
  'public_description',
  'public_phone',
  'public_email',
  'website_url',
  'facebook_url',
  'instagram_url',
  'linkedin_url',
  'opening_hours',
  'saturday_hours',
  'availability_status',
];
const INPUT_FIELDS = ['location_id', ...ROUTINE_FIELDS];
const AVAILABILITY_STATUSES = ['astazi', 'urmatoarele_zile', 'saptamana_aceasta', 'doar_programare', 'necunoscuta'];
const MAX_DESCRIPTION_LEN = 2000;
const MAX_URL_LEN = 500;
const MAX_CONTACT_LEN = 200;
const MAX_HOURS_LEN = 500;
const LEGACY_MIRRORS = { public_description: ['description'], website_url: ['website'], public_phone: ['phone_public'] };
const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function normalizeMemberRole(role) { if (role === 'owner') return 'organization_owner'; if (role === 'staff') return 'location_staff'; return MEMBER_ROLES.includes(role) ? role : ''; }

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

  if ('public_description' in p) {
    const cleaned = cleanPlainText(p.public_description, 'public_description', MAX_DESCRIPTION_LEN);
    if (cleaned.error) return cleaned;
    updates.public_description = cleaned.value;
  }
  if ('public_phone' in p) {
    const cleaned = cleanPhone(p.public_phone);
    if (cleaned.error) return cleaned;
    updates.public_phone = cleaned.value;
  }
  if ('public_email' in p) {
    const cleaned = cleanEmail(p.public_email);
    if (cleaned.error) return cleaned;
    updates.public_email = cleaned.value;
  }
  for (const field of ['website_url', 'facebook_url', 'instagram_url', 'linkedin_url']) {
    if (field in p) {
      const cleaned = cleanUrl(p[field], field);
      if (cleaned.error) return cleaned;
      updates[field] = cleaned.value;
    }
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

  for (const [field, mirrors] of Object.entries(LEGACY_MIRRORS)) {
    if (field in updates) {
      for (const mirror of mirrors) updates[mirror] = updates[field];
    }
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

    const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: locationId, status: 'active' });
    if (!memberships.some((m) => normalizeMemberRole(m.role))) return reject('Nu ai acces la aceasta locatie', 403);

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