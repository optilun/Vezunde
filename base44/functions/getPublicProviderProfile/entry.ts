import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  isServicePubliclyEligible,
  normalizeServiceKey,
} from '../../../shared/canonicalServiceRegistryExtended.js';
import { evaluateServicePrerequisites } from '../../../shared/servicePrerequisiteEngine.js';

const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

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

function isPublicSafeService(service, location, prerequisiteContext) {
  if (service?.migration_review_required) return false;
  if (!isServicePubliclyEligible(service, location)) return false;
  return evaluateServicePrerequisites(service?.service_key || service?.key, prerequisiteContext).eligible;
}

function toPublicService(service) {
  const normalized = normalizeServiceKey(service?.service_key || service?.key);
  if (!normalized.definition || !normalized.canonicalKey) return null;
  return { key: normalized.canonicalKey, label: normalized.definition.label };
}

function publicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || /\s/.test(raw)) return null;
  const normalized = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : raw.startsWith('//') ? `https:${raw}` : `https://${raw}`;
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || !parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch (_error) {
    return null;
  }
}

function publicImage(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.length <= 800000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(raw)) return raw;
  return publicUrl(raw);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const locationId = payload.location_id ? String(payload.location_id) : null;
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    const controlStatus = location ? (location.profile_control_status || 'directory') : null;
    if (
      !location
      || location.status !== 'publicata'
      || location.active_status === 'inactiva'
      || controlStatus === 'suspended'
      || !location.provider_profile_type
      || !PATIENT_FACING_PROFILE_TYPES.includes(location.provider_profile_type)
    ) return Response.json({ error: 'Profilul nu a fost gasit' }, { status: 404 });

    const organization = location.organization_id
      ? await svc.entities.ProviderOrganization.get(location.organization_id).catch(() => null)
      : null;

    const [services, assignments, equipment, facilities] = await Promise.all([
      svc.entities.LocationService.filter({ location_id: location.id }, null, 300),
      svc.entities.ProfessionalLocationAssignment.filter({ location_id: location.id, active_status: 'activ' }, null, 100),
      svc.entities.LocationEquipment.filter({ location_id: location.id }, null, 300).catch(() => []),
      svc.entities.LocationFacility.filter({ location_id: location.id }, null, 300).catch(() => []),
    ]);

    const profiles = await Promise.all(assignments.map((assignment) => svc.entities.ProfessionalProfile.get(assignment.professional_id).catch(() => null)));
    const prerequisiteContext = { location, assignments, professionals: profiles.filter(Boolean), equipment, facilities };
    const publicServices = services.filter((service) => isPublicSafeService(service, location, prerequisiteContext)).map(toPublicService).filter(Boolean);

    const team = assignments.map((assignment, index) => {
      const profile = profiles[index];
      if (!profile || assignment.public_status !== 'public' || profile.is_public !== true || profile.verification_status !== 'verified' || profile.public_visibility_status !== 'approved') return null;
      const displayName = profile.public_display_name || profile.full_name;
      if (!displayName) return null;
      return {
        id: profile.id,
        full_name: displayName,
        professional_type: profile.professional_type || assignment.professional_type,
        bio: profile.professional_bio || profile.bio || null,
        profile_photo_url: publicImage(profile.profile_photo_url),
        specializations: Array.isArray(profile.specializations) ? profile.specializations.slice(0, 6) : [],
        verified: true,
      };
    }).filter(Boolean);

    let availabilityLabel = null;
    if (location.availability_status && location.availability_status !== 'necunoscuta' && location.availability_updated_at) {
      const ageDays = (Date.now() - new Date(location.availability_updated_at).getTime()) / 86400000;
      if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) availabilityLabel = AVAILABILITY_LABELS[location.availability_status] || null;
    }

    const organizationName = organization?.public_display_name || organization?.name || null;
    return Response.json({
      profile: {
        id: location.id,
        organization_id: organization?.id || null,
        organization_name: organizationName,
        organization_logo_url: publicImage(organization?.logo_url),
        organization_description: organization?.public_description || null,
        name: location.public_display_name || location.name,
        provider_type: location.provider_type,
        provider_profile_type: location.provider_profile_type,
        city: location.city,
        county: location.county || null,
        address: location.address || null,
        lat: location.lat ?? null,
        lng: location.lng ?? null,
        place_id: location.place_id || null,
        phone_public: location.public_phone || location.phone_public || null,
        public_email: location.public_email || null,
        website: publicUrl(organization?.website_url || organization?.website || location.website_url || location.website),
        facebook: publicUrl(organization?.facebook_url || location.facebook_url),
        instagram: publicUrl(organization?.instagram_url || location.instagram_url),
        linkedin: publicUrl(organization?.linkedin_url || location.linkedin_url),
        description: location.public_description || location.description || organization?.public_description || null,
        photo_url: publicImage(location.photo_url || location.profile_photo_url),
        opening_hours: location.opening_hours || null,
        saturday_hours: location.saturday_hours || null,
        profile_control_status: controlStatus,
        status_label: STATUS_LABELS[controlStatus] || STATUS_LABELS.directory,
        availability_label: availabilityLabel,
        services: publicServices,
        team,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});