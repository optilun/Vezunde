import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Module 3E: single public read-only profile endpoint. Returns ONLY whitelisted
// public data. Never exposes provenance, trust, audit, claim, migration,
// membership or internal verification fields.

// Canonical need-level catalog (mirrors matchProviders — functions cannot share local imports).
const NEED_LEVELS = {
  eyeglasses: 'general', frames: 'general', prescription_lenses: 'general', contact_lenses: 'general',
  optometry_consultation: 'general', ophthalmology_consultation: 'general',
  control_vedere_adulti: 'general', control_vedere_copii: 'general', consult_oftalmologic: 'general',
  lentile_contact: 'general', lentile_progresive: 'general',
  eyeglasses_adjustment: 'technical', eyeglasses_repair: 'technical', lens_fitting: 'technical',
  reparatii_ochelari: 'technical', reglaj_rame: 'technical', montaj_lentile: 'technical',
  oct: 'specialized_medical', retina_consultation: 'specialized_medical', glaucoma_consultation: 'specialized_medical',
  cataract_surgery: 'specialized_medical', refractive_surgery: 'specialized_medical',
  pediatric_ophthalmology: 'specialized_medical', myopia_management: 'specialized_medical', emergency_ophthalmology: 'specialized_medical',
  retina: 'specialized_medical', glaucom: 'specialized_medical', cataracta: 'specialized_medical',
  chirurgie_refractiva: 'specialized_medical', managementul_miopiei: 'specialized_medical',
};

const PUBLIC_CONF = ['publicly_listed', 'provider_confirmed', 'vezunde_verified'];
// Patient public profile = location/unit page only. Independent professionals and
// laboratories stay out of the patient directory; they can appear through a unit team.
const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store', 'optical_chain', 'ophthalmology_clinic', 'ophthalmology_office',
];
const STATUS_LABELS = {
  verified: 'Profil verificat de Vezunde',
  claimed: 'Profil revendicat',
  directory: 'Profil din director',
};
const AVAILABILITY_LABELS = {
  astazi: 'Disponibil astazi',
  urmatoarele_zile: 'Disponibil in urmatoarele zile',
  saptamana_aceasta: 'Disponibil saptamana aceasta',
  doar_programare: 'Doar cu programare',
};
const AVAILABILITY_STALE_DAYS = 30;

// Module 3E.1: shared public-safe service visibility rule (mirrored in matchProviders).
function isPublicSafeService(s, pcs) {
  if (s.is_active === false) return false;
  if (s.migration_review_required) return false;
  if (!PUBLIC_CONF.includes(s.confirmation_level)) return false;
  const level = (s.is_advanced_service || s.service_need_level === 'specialized_medical')
    ? 'specialized_medical'
    : (NEED_LEVELS[s.service_key] || 'unknown');
  if (level === 'specialized_medical' || level === 'unknown') {
    return s.confirmation_level === 'vezunde_verified' && pcs === 'verified';
  }
  return true;
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
    // Suspended, unpublished or inactive profiles are never rendered publicly —
    // same 404 in all cases, no state disclosure.
    // Module 3H.1A.1: fail closed — missing classification, independent professional
    // or B2B/B2C lab profile types are never rendered as patient-facing provider pages.
    if (!loc || loc.status !== 'publicata' || loc.active_status === 'inactiva' || pcs === 'suspended'
        || !loc.provider_profile_type
        || !PATIENT_FACING_PROFILE_TYPES.includes(loc.provider_profile_type)) {
      return Response.json({ error: 'Profilul nu a fost gasit' }, { status: 404 });
    }

    const [services, assigns] = await Promise.all([
      svc.entities.LocationService.filter({ location_id: loc.id }, null, 200),
      svc.entities.ProfessionalLocationAssignment.filter({ location_id: loc.id, active_status: 'activ', public_status: 'public' }, null, 100),
    ]);

    // Public services: active, review-clean, confirmation_level publicly_listed /
    // provider_confirmed / vezunde_verified. Specialized medical (and unknown /
    // uncategorized) keys require vezunde_verified service + verified profile.
    const publicServices = services
      .filter((s) => isPublicSafeService(s, pcs))
      .map((s) => s.service_key);

    const profiles = await Promise.all(
      assigns.map((a) => svc.entities.ProfessionalProfile.get(a.professional_id).catch(() => null))
    );
    const team = assigns
      .map((a, i) => {
        const p = profiles[i];
        if (!p || p.is_public === false) return null;
        return {
          full_name: p.full_name,
          professional_type: a.professional_type,
          bio: p.bio || null,
          affiliation_status: a.affiliation_status || 'location_added',
        };
      })
      .filter(Boolean);

    // Availability: only provider-published and fresh (explicitly public by design).
    let availabilityLabel = null;
    if (loc.availability_status && loc.availability_status !== 'necunoscuta' && loc.availability_updated_at) {
      const ageDays = (Date.now() - new Date(loc.availability_updated_at).getTime()) / 86400000;
      if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) {
        availabilityLabel = AVAILABILITY_LABELS[loc.availability_status] || null;
      }
    }

    // STRICT public whitelist — nothing else leaves this function.
    return Response.json({
      profile: {
        id: loc.id,
        name: loc.name,
        provider_type: loc.provider_type,
        city: loc.city,
        county: loc.county || null,
        address: loc.address || null,
        phone_public: loc.phone_public || null,
        public_email: loc.public_email || null,
        website: loc.website || null,
        description: loc.description || null,
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