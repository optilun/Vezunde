import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Public read-only provider profile endpoint.
// Returns only whitelisted public data.

const PUBLIC_CONF = ['publicly_listed', 'provider_confirmed', 'vezunde_verified'];
const PATIENT_FACING_PROFILE_TYPES = ['independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office'];

const STATUS_LABELS = {
  verified: 'Profil verificat de Vezunde',
  claimed: 'Profil revendicat',
  directory: 'Profil din director',
};

const AVAILABILITY_LABELS = {
  astazi: 'Primeste clienti fara programare',
  urmatoarele_zile: 'Primeste clienti si cu programare',
  saptamana_aceasta: 'Walk-in pentru optica, programare pentru consultatii',
  doar_programare: 'Doar cu programare',
};

const AVAILABILITY_STALE_DAYS = 30;

function isPublicSafeService(s, pcs) {
  if (s.is_active === false) return false;
  if (s.migration_review_required) return false;
  if (!PUBLIC_CONF.includes(s.confirmation_level)) return false;
  const level = (s.is_advanced_service || s.service_need_level === 'specialized_medical') ? 'specialized_medical' : (NEED_LEVELS[s.service_key] || 'unknown');
  if (level === 'specialized_medical' || level === 'unknown') return s.confirmation_level === 'vezunde_verified' && pcs === 'verified';
  return true;
}

function toPublicService(s) {
  return { key: s.service_key, label: SERVICE_LABELS[s.service_key] || s.service_key };
}

function publicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/\s/.test(raw)) return null;
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const locationId = payload.location_id ? String(payload.location_id) : null;
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const loc = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    const pcs = loc ? (loc.profile_control_status || 'directory') : null;
    if (!loc || loc.status !== 'publicata' || loc.active_status === 'inactiva' || pcs === 'suspended'
        || !loc.provider_profile_type || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) {
      return Response.json({ error: 'Profilul nu a fost gasit' }, { status: 404 });
    }

    const [services, assigns] = await Promise.all([
      svc.entities.LocationService.filter({ location_id: loc.id }, null, 300),
      svc.entities.ProfessionalLocationAssignment.filter({ location_id: loc.id, active_status: 'activ', public_status: 'public' }, null, 100),
    ]);

    const publicServices = services
      .filter((s) => isPublicSafeService(s, pcs))
      .map(toPublicService);

    const profiles = await Promise.all(assigns.map((a) => svc.entities.ProfessionalProfile.get(a.professional_id).catch(() => null)));
    const team = assigns.map((a, i) => {
      const p = profiles[i];
      if (!p || p.is_public === false) return null;
      return {
        full_name: p.full_name,
        professional_type: a.professional_type,
        bio: p.bio || null,
        affiliation_status: a.affiliation_status || 'location_added',
      };
    }).filter(Boolean);

    let availabilityLabel = null;
    if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
      const ageDays = (Date.now() - new Date(loc.availability_updated_at).getTime()) / 86400000;
      if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
    }

    return Response.json({
      profile: {
        id: loc.id,
        name: loc.public_display_name || loc.name,
        provider_type: loc.provider_type,
        provider_profile_type: loc.provider_profile_type,
        city: loc.city,
        county: loc.county || null,
        address: loc.address || null,
        lat: loc.lat ?? null,
        lng: loc.lng ?? null,
        place_id: loc.place_id || null,
        phone_public: loc.public_phone || loc.phone_public || null,
        public_email: loc.public_email || null,
        website: publicUrl(loc.website_url || loc.website),
        facebook: publicUrl(loc.facebook_url),
        instagram: publicUrl(loc.instagram_url),
        linkedin: publicUrl(loc.linkedin_url),
        description: loc.public_description || loc.description || null,
        photo_url: loc.photo_url || null,
        opening_hours: loc.opening_hours || null,
        saturday_hours: loc.saturday_hours || null,
        profile_control_status: pcs,
        status_label: STATUS_LABELS[pcs] || STATUS_LABELS.directory,
        availability_label: availabilityLabel,
        services: publicServices,
        team,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
