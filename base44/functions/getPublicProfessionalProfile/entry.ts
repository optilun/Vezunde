import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  normalizeProfessionalType,
  professionalTypeLabel,
  professionalSpecializationLabel,
  sanitizeProfessionalSpecializations,
} from '../../shared/professionalIdentity.js';
import { isPublicProfessionalProfile } from '../../shared/professionalProfileStatus.js';

const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

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

// Poarta publica a profilului este acum in shared/professionalProfileStatus.js, ca sa fie
// aceeasi conditie si aici, si in motorul de recomandare, si in reconcilierea asocierilor.
function isPublicProfile(profile) {
  return isPublicProfessionalProfile(profile);
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
  return sanitizeProfessionalSpecializations(profile.professional_type, profile.specializations, 12);
}

async function publicLocationRows(svc, professionalId) {
  const assignments = (await svc.entities.ProfessionalLocationAssignment.filter({
    professional_id: professionalId,
    active_status: 'activ',
    public_status: 'public',
  }, '-created_date', 100))
    // Consimtamantul explicit se recontroleaza aici, nu se presupune din `public_status`. Cele
    // doua ar trebui sa fie mereu de acord; daca vreodata nu sunt, decide consimtamantul.
    .filter((assignment) => assignment?.visibility_consent_status === 'accepted');

  const rows = await Promise.all(assignments.map(async (assignment) => {
    const location = await svc.entities.ProviderLocation.get(assignment.location_id).catch(() => null);
    if (!isPublicLocation(location)) return null;
    const organization = location.organization_id
      ? await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null)
      : null;
    return {
      id: location.id,
      name: location.public_display_name || location.name || 'Locatie',
      // 2026-09-03: `organization_id` si `profile_control_status` sunt trimise ca sa existe drum
      // real de la specialist la organizatie, nu doar un nume care nu duce nicaieri.
      organization_id: location.organization_id || null,
      organization_name: organization?.public_display_name || organization?.name || null,
      profile_control_status: location.profile_control_status || 'directory',
      city: location.locality_name || location.city || '',
      county: location.county_name || location.county || '',
      address: location.address || '',
      phone: text(location.phone_public) || null,
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
        professional_type: normalizeProfessionalType(profile.professional_type || profile.role),
        professional_type_label: professionalTypeLabel(profile.professional_type || profile.role),
        bio: text(profile.professional_bio || profile.bio),
        profile_photo_url: publicImage(profile.profile_photo_url),
        specializations: safeSpecializations(profile),
        specialization_labels: safeSpecializations(profile).map(professionalSpecializationLabel),
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
