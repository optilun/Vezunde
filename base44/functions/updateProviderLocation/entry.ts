import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { normalizeServiceKey } from '../../shared/canonicalServiceRegistryExtended.js';

// Legacy profile update endpoint.
// Owners/staff can update opening hours + availability directly.
// Everything else is staged in pending_changes for admin review.
// Service writes are retained only for backward compatibility; new non-canonical
// keys are rejected and existing legacy/unknown rows are preserved by exact key.
const DIRECT_FIELDS = ['opening_hours', 'saturday_hours', 'availability_status'];
// Module 3F.2.2: city/county are NOT provider-editable fields. Geography changes
// are staged ONLY as a canonical locality_siruta_code (validated below).
const STAGED_FIELDS = ['name', 'address', 'phone_public', 'public_email', 'website', 'description', 'provider_type'];
const MEMBER_ROLES = ['organization_owner', 'location_manager', 'location_staff'];
function normalizeMemberRole(role) { if (role === 'owner') return 'organization_owner'; if (role === 'staff') return 'location_staff'; return MEMBER_ROLES.includes(role) ? role : ''; }

function cleanServiceKeys(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((key) => String(key || '').trim())
    .filter(Boolean))];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const p = await req.json().catch(() => ({}));
    if (!p.location_id) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    // Module 3F.2.3: geographic payload contract validated BEFORE any data access.
    // city/county/county_name are NEVER provider-editable; locality changes only
    // via a validated canonical locality_siruta_code (GeographicLocality).
    const staged = p.staged || {};
    const sf = staged.fields || {};
    if (sf.city !== undefined || sf.county !== undefined || sf.county_name !== undefined) {
      return Response.json({ error: 'Orasul si judetul nu pot fi editate direct — selecteaza localitatea din lista oficiala' }, { status: 400 });
    }
    let stagedSiruta = null;
    if (sf.locality_siruta_code !== undefined) {
      const code = String(sf.locality_siruta_code || '').trim();
      if (!code) return Response.json({ error: 'Codul localitatii selectate lipseste' }, { status: 400 });
      const geoRows = await svc.entities.GeographicLocality.filter({ siruta_code: code, is_active: true });
      if (!geoRows[0]) return Response.json({ error: 'Localitatea selectata nu exista sau nu este activa' }, { status: 400 });
      stagedSiruta = code;
    }

    if (user.role !== 'admin') {
      const memberships = await svc.entities.ProviderMembership.filter({
        user_id: user.id, location_id: p.location_id, status: 'active',
      });
      if (!memberships.some((m) => normalizeMemberRole(m.role))) {
        return Response.json({ error: 'Nu ai acces la aceasta locatie' }, { status: 403 });
      }
    }

    const loc = await svc.entities.ProviderLocation.get(p.location_id);
    if (!loc) return Response.json({ error: 'Locatia nu a fost gasita' }, { status: 404 });
    if (loc.verification_state === 'suspended' || loc.profile_control_status === 'suspended') {
      return Response.json({ error: 'Profilul este suspendat si nu poate fi modificat' }, { status: 403 });
    }

    let stagedServices = null;
    if (Array.isArray(staged.services)) {
      stagedServices = cleanServiceKeys(staged.services);
      const existingRows = await svc.entities.LocationService.filter({ location_id: loc.id }, null, 500);
      const existingRawKeys = new Set(existingRows.map((row) => String(row.service_key || '').trim()).filter(Boolean));
      const invalidNewKeys = stagedServices.filter((key) => (
        normalizeServiceKey(key).status !== 'canonical' && !existingRawKeys.has(key)
      ));
      if (invalidNewKeys.length > 0) {
        return Response.json({
          error: 'Fluxul vechi nu poate introduce servicii legacy, ambigue sau necunoscute noi. Foloseste configuratorul Servicii.',
          fields: invalidNewKeys,
        }, { status: 400 });
      }
    }

    const upd = {};
    const direct = p.direct || {};
    for (const k of DIRECT_FIELDS) {
      if (direct[k] !== undefined) upd[k] = direct[k];
    }
    if (direct.availability_status !== undefined) {
      upd.availability_updated_at = new Date().toISOString();
    }

    const hasStagedFields = staged.fields && Object.keys(staged.fields).length > 0;
    const hasStagedArrays = Array.isArray(staged.services) || Array.isArray(staged.specializations) || Array.isArray(staged.facilities);
    if (hasStagedFields || hasStagedArrays) {
      let prev = {};
      try { prev = loc.pending_changes ? JSON.parse(loc.pending_changes) : {}; } catch (_e) { prev = {}; }
      const fields = { ...(prev.fields || {}) };
      if (hasStagedFields) {
        for (const k of STAGED_FIELDS) {
          if (staged.fields[k] !== undefined) fields[k] = staged.fields[k];
        }
        // Locality change is staged ONLY as the validated canonical siruta code.
        if (stagedSiruta) fields.locality_siruta_code = stagedSiruta;
      }
      const next = { fields };
      if (Array.isArray(staged.services)) next.services = stagedServices;
      else if (prev.services) next.services = prev.services;
      if (Array.isArray(staged.specializations)) next.specializations = staged.specializations;
      else if (prev.specializations) next.specializations = prev.specializations;
      if (Array.isArray(staged.facilities)) next.facilities = staged.facilities;
      else if (prev.facilities) next.facilities = prev.facilities;
      upd.pending_changes = JSON.stringify(next);
    }

    if (Object.keys(upd).length === 0) {
      return Response.json({ error: 'Nicio modificare de aplicat' }, { status: 400 });
    }

    await svc.entities.ProviderLocation.update(loc.id, upd);
    return Response.json({ success: true, staged: !!upd.pending_changes });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
