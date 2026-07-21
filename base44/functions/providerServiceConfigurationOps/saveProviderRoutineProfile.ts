import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  formatProviderSaturdayHours,
  formatProviderWeeklyHours,
  validateProviderOpeningHours,
} from '../../../shared/providerOpeningHours.js';

// Fast-path provider routine updates.
// Only operational schedule/access-mode fields are allowed here.
// Public identity/contact/description/website/social changes must go through ProviderWorkspaceSubmission review.

const ROUTINE_FIELDS = [
  'opening_hours_json',
  'opening_hours',
  'saturday_hours',
  'availability_status',
  'availability_updated_at',
  'request_intake_status',
];
const INPUT_FIELDS = ['location_id', ...ROUTINE_FIELDS];
const AVAILABILITY_STATUSES = ['astazi', 'urmatoarele_zile', 'saptamana_aceasta', 'doar_programare', 'necunoscuta'];
const REQUEST_INTAKE_STATUSES = ['inactive', 'active', 'paused'];
const MAX_HOURS_LEN = 500;
const MAX_JSON_LEN = 12000;
const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];

function normalizeMemberRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

function reject(error, status = 400, fields = []) {
  return Response.json({ error, fields }, { status });
}

function cleanPlainText(value, field, maxLen) {
  const val = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (val.length > maxLen) return { error: `${field} depaseste lungimea maxima` };
  if (/[<>]/.test(val) || /<\/?[a-z][\s\S]*>/i.test(val)) return { error: `${field} trebuie sa fie text simplu, fara HTML` };
  return { value: val };
}

function cleanOpeningHoursJson(value) {
  const raw = String(value || '').trim();
  if (!raw) return { value: '', openingHours: '', saturdayHours: '' };
  if (raw.length > MAX_JSON_LEN) return { error: 'opening_hours_json este prea lung' };
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    return { error: 'opening_hours_json trebuie sa fie JSON valid' };
  }
  const checked = validateProviderOpeningHours(parsed);
  if (!checked.valid) return { error: checked.error, fields: checked.fields || [] };
  return {
    value: JSON.stringify(checked.value),
    openingHours: formatProviderWeeklyHours(checked.value.weekly),
    saturdayHours: formatProviderSaturdayHours(checked.value.weekly),
  };
}

function cleanPayload(p) {
  const keys = Object.keys(p).filter((key) => key !== 'action');
  const unknown = keys.filter((key) => !INPUT_FIELDS.includes(key));
  if (unknown.length > 0) return { error: 'Camp nepermis in update rapid. Datele publice trebuie trimise spre review.', fields: unknown };

  const updates = {};
  if ('opening_hours_json' in p) {
    const cleaned = cleanOpeningHoursJson(p.opening_hours_json);
    if (cleaned.error) return cleaned;
    updates.opening_hours_json = cleaned.value;
    updates.opening_hours = cleaned.openingHours;
    updates.saturday_hours = cleaned.saturdayHours;
  } else {
    for (const field of ['opening_hours', 'saturday_hours']) {
      if (field in p) {
        const cleaned = cleanPlainText(p[field], field, MAX_HOURS_LEN);
        if (cleaned.error) return cleaned;
        updates[field] = cleaned.value;
      }
    }
  }
  if ('availability_status' in p) {
    if (!AVAILABILITY_STATUSES.includes(p.availability_status)) return { error: 'Mod de primire invalid' };
    updates.availability_status = p.availability_status;
    updates.availability_updated_at = new Date().toISOString();
  }
  if ('availability_updated_at' in p && !updates.availability_updated_at) {
    updates.availability_updated_at = new Date().toISOString();
  }
  if ('request_intake_status' in p) {
    if (!REQUEST_INTAKE_STATUSES.includes(p.request_intake_status)) return { error: 'Status primire cereri invalid' };
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

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return reject('Autentificare necesara', 401);
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));

    const locationId = String(p.location_id || '').trim();
    if (!locationId) return reject('location_id este obligatoriu');

    const memberships = await svc.entities.ProviderMembership.filter({ user_id: user.id, location_id: locationId, status: 'active' });
    if (!memberships.some((membership) => normalizeMemberRole(membership.role))) return reject('Nu ai acces la aceasta locatie', 403);

    const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    if (!loc) return reject('Locatia nu a fost gasita', 404);
    if ((loc.profile_control_status || '') === 'suspended' || loc.status === 'suspendata') return reject('Profilul este suspendat', 403);
    if (loc.claim_verification_status !== 'approved') return reject('Update-urile rapide sunt disponibile doar dupa aprobarea revendicarii', 403);

    const cleaned = cleanPayload(p);
    if (cleaned.error) return reject(cleaned.error, 400, cleaned.fields || []);
    const updates = cleaned.updates;

    const previous = {};
    for (const key of Object.keys(updates)) previous[key] = loc[key];
    await svc.entities.ProviderLocation.update(loc.id, updates);
    await audit(svc, user, {
      entity_type: 'ProviderLocation',
      entity_id: loc.id,
      action_type: 'provider_fast_path_schedule_update',
      changed_fields: Object.keys(updates),
      previous,
      next: updates,
      note: 'Update rapid permis doar pentru program si mod de primire clienti/pacienti',
    });

    return Response.json({ success: true, updates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
