import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Provider logo change request. Upload/storage is done client-side through the
// Base44 file integration; this function only stages the resulting image URL for
// admin review. Nothing becomes public until reviewProfileChanges approves it.

const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function normalizeMemberRole(role) {
  if (role === 'owner') return 'organization_owner';
  if (role === 'staff') return 'location_staff';
  return MEMBER_ROLES.includes(role) ? role : '';
}

function reject(error, status = 400) {
  return Response.json({ error }, { status });
}

function cleanImageUrl(value) {
  const val = String(value || '').trim();
  if (!val) return { error: 'Imaginea lipseste' };
  if (val.length > 1200) return { error: 'URL-ul imaginii este prea lung' };
  let parsed;
  try { parsed = new URL(val); } catch (_e) { return { error: 'Imagine invalida' }; }
  if (!['https:', 'http:'].includes(parsed.protocol)) return { error: 'Imaginea trebuie sa fie incarcata printr-un URL sigur' };
  if (/\b(?:javascript|data|vbscript|file):/i.test(val)) return { error: 'Imaginea contine protocol nesigur' };
  return { value: parsed.toString() };
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
    if (loc.claim_verification_status !== 'approved') return reject('Logo-ul poate fi trimis dupa aprobarea revendicarii', 403);

    const cleaned = cleanImageUrl(p.photo_url);
    if (cleaned.error) return reject(cleaned.error);

    let pending = {};
    try { pending = loc.pending_changes ? JSON.parse(loc.pending_changes) : {}; } catch (_e) { pending = {}; }
    const fields = { ...(pending.fields || {}), photo_url: cleaned.value };
    const nextPending = {
      ...pending,
      fields,
      media_review: {
        ...(pending.media_review || {}),
        logo_submitted_by_user_id: user.id,
        logo_submitted_at: new Date().toISOString(),
      },
    };

    await svc.entities.ProviderLocation.update(loc.id, { pending_changes: JSON.stringify(nextPending) });
    await svc.entities.DirectoryAuditRecord.create({
      entity_type: 'ProviderLocation',
      entity_id: loc.id,
      action_type: 'provider_logo_submitted_for_review',
      changed_fields: ['photo_url'],
      previous_values: JSON.stringify({ photo_url: loc.photo_url || '' }),
      new_values: JSON.stringify({ photo_url: cleaned.value }),
      admin_user_id: user.id,
      admin_email: user.email,
      note: 'Logo trimis de provider spre review admin',
      performed_at: new Date().toISOString(),
    });

    return Response.json({ success: true, pending_changes: nextPending });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
