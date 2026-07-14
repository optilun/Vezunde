import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

const SPECIALIZATIONS_BY_TYPE = {
  ophthalmologist: [
    'general_ophthalmology', 'pediatric_ophthalmology', 'glaucoma', 'retina', 'cornea',
    'cataract', 'refractive_surgery', 'dry_eye', 'myopia_management',
  ],
  optometrist: [
    'refraction', 'contact_lenses', 'pediatric_optometry', 'binocular_vision',
    'myopia_management', 'low_vision', 'occupational_vision',
  ],
  optician: [
    'frame_consulting', 'ophthalmic_lenses', 'progressive_lenses', 'lens_fitting',
    'adjustments_repairs', 'children_eyewear', 'protective_eyewear',
  ],
};

function text(value) {
  return String(value || '').trim();
}

function publicUrl(value) {
  const raw = text(value);
  if (!raw || raw.length > 500 || /\s/.test(raw)) return null;
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw)
    ? raw
    : raw.startsWith('//')
      ? `https:${raw}`
      : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function publicImage(value) {
  const raw = text(value);
  if (!raw) return null;
  if (raw.length <= 800000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  return publicUrl(raw);
}

function isPublicProfile(profile) {
  return Boolean(
    profile
    && profile.is_public === true
    && profile.verification_status === 'verified'
    && profile.public_visibility_status === 'approved'
  );
}

function isPublicLocation(location) {
  return Boolean(
    location
    && location.status === 'publicata'
    && location.active_status !== 'inactiva'
    && location.profile_control_status !== 'suspended'
    && PATIENT_FACING_PROFILE_TYPES.includes(location.provider_profile_type)
  );
}

function safeSpecializations(profile) {
  const allowed = new Set(SPECIALIZATIONS_BY_TYPE[profile.professional_type] || []);
  return [...new Set((Array.isArray(profile.specializations) ? profile.specializations : [])
    .map(text)
    .filter((item) => allowed.has(item)))]
    .slice(0, 12);
}

async function publicLocationRows(svc, professionalId) {
  const assignments = await svc.entities.ProfessionalLocationAssignment.filter({
    professional_id: professionalId,
    active_status: 'activ',
    public_status: 'public',
  }, '-created_date', 100);

  const rows = await Promise.all(assignments.map(async (assignment) => {
    const location = await svc.entities.ProviderLocation.get(assignment.location_id).catch(() => null);
    if (!isPublicLocation(location)) return null;
    const organization = location.organization_id
      ? await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null)
      : null;
    return {
      id: location.id,
      name: location.public_display_name || location.name || 'Locatie',
      organization_name: organization?.public_display_name || organization?.name || null,
      city: location.locality_name || location.city || '',
      county: location.county_name || location.county || '',
      address: location.address || '',
      image_url: publicImage(location.profile_photo_url || location.photo_url || organization?.logo_url),
    };
  }));

  return rows.filter(Boolean);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const professionalId = text(payload.professional_id || payload.profile_id);
    if (!professionalId || professionalId.length > 200) {
      return Response.json({ error: 'professional_id este obligatoriu' }, { status: 400 });
    }

    const profile = await svc.entities.ProfessionalProfile.get(professionalId).catch(() => null);
    if (!isPublicProfile(profile)) {
      return Response.json({ error: 'Profilul profesional nu a fost gasit' }, { status: 404 });
    }

    const displayName = text(profile.public_display_name || profile.full_name);
    if (!displayName) {
      return Response.json({ error: 'Profilul profesional nu a fost gasit' }, { status: 404 });
    }

    return Response.json({
      profile: {
        id: profile.id,
        display_name: displayName,
        professional_type: profile.professional_type || '',
        bio: text(profile.professional_bio || profile.bio),
        profile_photo_url: publicImage(profile.profile_photo_url),
        specializations: safeSpecializations(profile),
        verified: true,
        accepts_independent_requests: profile.accepts_independent_requests === true,
        public_phone: text(profile.public_phone) || null,
        public_email: text(profile.public_email).toLowerCase() || null,
        website: publicUrl(profile.public_website_url),
        linkedin: publicUrl(profile.linkedin_url),
        facebook: publicUrl(profile.facebook_url),
        instagram: publicUrl(profile.instagram_url),
        locations: await publicLocationRows(svc, profile.id),
      },
    });
  } catch (error) {
    console.error('getPublicProfessionalProfile failed', error);
    return Response.json({ error: 'Profilul profesional nu a putut fi incarcat' }, { status: 500 });
  }
});
