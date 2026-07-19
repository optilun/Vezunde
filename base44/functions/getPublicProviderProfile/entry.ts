import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  evaluateServicePrerequisites,
  isServicePubliclyEligible,
  normalizeServiceKey,
} from './sharedDependencies.js';
import { getPublicLocationDisclosure } from './providerPublicTrust.js';

const PATIENT_FACING_PROFILE_TYPES = [
  'independent_optical_store',
  'optical_chain',
  'ophthalmology_clinic',
  'ophthalmology_office',
];

const STATUS_LABELS = {
  verified: 'Locatie verificata',
  claimed: 'Profil revendicat',
  directory: 'Profil nerevendicat',
};

const AVAILABILITY_LABELS = {
  astazi: 'Primeste clienti fara programare',
  urmatoarele_zile: 'Primeste clienti si cu programare',
  saptamana_aceasta: 'Walk-in pentru optica, programare pentru consultatii',
  doar_programare: 'Doar cu programare',
};

const AVAILABILITY_STALE_DAYS = 30;
const MAX_INLINE_LOGO_BYTES = 450000;

function isPublicSafeService(service, location, prerequisiteContext) {
  if (service?.migration_review_required) return false;
  if (!isServicePubliclyEligible(service, location)) return false;
  return evaluateServicePrerequisites(service?.service_key || service?.key, prerequisiteContext).eligible;
}

function toPublicService(service) {
  const normalized = normalizeServiceKey(service?.service_key || service?.key);
  if (!normalized.definition || !normalized.canonicalKey) return null;
  return {
    key: normalized.canonicalKey,
    label: normalized.definition.label,
    confirmation_level: service?.confirmation_level || 'not_confirmed',
  };
}

function serviceConfirmationLevel(services = []) {
  if (services.length === 0) return null;
  if (services.every((service) => service.confirmation_level === 'vezunde_verified')) return 'vezunde_verified';
  if (services.every((service) => ['provider_confirmed', 'vezunde_verified'].includes(service.confirmation_level))) return 'provider_confirmed';
  return null;
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

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return btoa(binary);
}

async function resilientPublicLogo(value) {
  const safeUrl = publicImage(value);
  if (!safeUrl || safeUrl.startsWith('data:image/')) return safeUrl;

  try {
    const parsed = new URL(safeUrl);
    const isBase44PublicFile = parsed.hostname === 'base44.app' && parsed.pathname.includes('/files/mp/public/');
    if (!isBase44PublicFile) return safeUrl;

    const response = await fetch(safeUrl, {
      headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*' },
    });
    if (!response.ok) return safeUrl;

    const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) return safeUrl;

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_INLINE_LOGO_BYTES) return safeUrl;
    return `data:${contentType};base64,${bytesToBase64(bytes)}`;
  } catch (_error) {
    return safeUrl;
  }
}

function normalizedCopy(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ro-RO');
}

function exactMapPosition(location) {
  if (String(location?.place_id || '').trim()) return true;
  const lat = location?.lat;
  const lng = location?.lng;
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') return false;
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const payload = await req.json().catch(() => ({}));
    const locationId = payload.location_id ? String(payload.location_id) : null;
    if (!locationId) return Response.json({ error: 'location_id este obligatoriu' }, { status: 400 });

    const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
    const directoryStates = location
      ? await svc.entities.ProviderLocationDirectoryState.filter(
        { location_id: location.id, state_status: 'active' },
        '-normalized_at',
        1,
      ).catch(() => [])
      : [];
    const directoryRecord = location ? { ...location, ...(directoryStates[0] || {}) } : null;
    const publicDisclosure = directoryRecord ? getPublicLocationDisclosure(directoryRecord) : null;
    const controlStatus = publicDisclosure?.profile_control_status || null;
    if (
      !location
      || publicDisclosure?.is_publicly_available !== true
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
    const publicServices = publicDisclosure.expose_full_details
      ? services.filter((service) => isPublicSafeService(service, location, prerequisiteContext)).map(toPublicService).filter(Boolean)
      : [];

    const team = publicDisclosure.expose_full_details ? assignments.map((assignment, index) => {
      const profile = profiles[index];
      if (!profile || assignment.public_status !== 'public' || assignment.visibility_consent_status !== 'accepted' || profile.is_public !== true || profile.verification_status !== 'verified' || profile.public_visibility_status !== 'approved') return null;
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
    }).filter(Boolean) : [];

    let availabilityLabel = null;
    if (publicDisclosure.expose_full_details && location.availability_status && location.availability_status !== 'necunoscuta' && location.availability_updated_at) {
      const ageDays = (Date.now() - new Date(location.availability_updated_at).getTime()) / 86400000;
      if (ageDays >= 0 && ageDays <= AVAILABILITY_STALE_DAYS) availabilityLabel = AVAILABILITY_LABELS[location.availability_status] || null;
    }

    const organizationName = publicDisclosure.expose_full_details
      ? (organization?.public_display_name || organization?.name || null)
      : null;
    const organizationDescription = publicDisclosure.expose_full_details ? (organization?.public_description || null) : null;
    const rawLocationDescription = publicDisclosure.expose_full_details ? (location.public_description || location.description || null) : null;
    const locationDescription = rawLocationDescription && normalizedCopy(rawLocationDescription) !== normalizedCopy(organizationDescription)
      ? rawLocationDescription
      : null;
    const mapPrecision = publicDisclosure.exact_location_visible
      ? (exactMapPosition(location) ? 'exact' : location.address ? 'approximate' : null)
      : null;
    const organizationLogoUrl = publicDisclosure.expose_full_details
      ? await resilientPublicLogo(organization?.logo_url)
      : null;
    const website = publicDisclosure.expose_full_details
      ? publicUrl(organization?.website_url || organization?.website || publicDisclosure.website)
      : publicUrl(publicDisclosure.website);

    return Response.json({
      profile: {
        id: location.id,
        organization_id: publicDisclosure.expose_full_details ? (organization?.id || null) : null,
        organization_name: organizationName,
        organization_logo_url: organizationLogoUrl,
        organization_logo_configured: publicDisclosure.expose_full_details && Boolean(publicImage(organization?.logo_url)),
        organization_logo_version: organization?.profile_updated_at || organization?.updated_date || null,
        organization_description: organizationDescription,
        location_description: locationDescription,
        name: location.public_display_name || location.name,
        provider_type: location.provider_type,
        provider_profile_type: location.provider_profile_type,
        city: location.city,
        county: location.county || null,
        address: publicDisclosure.address,
        lat: publicDisclosure.lat,
        lng: publicDisclosure.lng,
        place_id: publicDisclosure.place_id,
        map_precision: mapPrecision,
        phone_public: publicDisclosure.phone,
        public_email: publicDisclosure.public_email,
        website,
        facebook: publicDisclosure.expose_full_details ? publicUrl(organization?.facebook_url || location.facebook_url) : null,
        instagram: publicDisclosure.expose_full_details ? publicUrl(organization?.instagram_url || location.instagram_url) : null,
        linkedin: publicDisclosure.expose_full_details ? publicUrl(organization?.linkedin_url || location.linkedin_url) : null,
        description: locationDescription || organizationDescription || rawLocationDescription,
        photo_url: publicDisclosure.expose_full_details ? publicImage(location.photo_url) : null,
        opening_hours: publicDisclosure.opening_hours,
        saturday_hours: publicDisclosure.saturday_hours,
        opening_hours_json: publicDisclosure.opening_hours_json,
        profile_control_status: controlStatus,
        control_status: publicDisclosure.control_status,
        publication_status: publicDisclosure.publication_status,
        operational_status: publicDisclosure.operational_status,
        data_quality_status: publicDisclosure.data_quality_status,
        organization_link_status: publicDisclosure.organization_link_status,
        location_type_code: publicDisclosure.location_type_code,
        care_setting_code: publicDisclosure.care_setting_code,
        ownership_type_code: publicDisclosure.ownership_type_code,
        public_detail_level: publicDisclosure.public_detail_level,
        exact_location_visible: publicDisclosure.exact_location_visible,
        contact_details_visible: publicDisclosure.contact_details_visible,
        expose_basic_details: publicDisclosure.expose_basic_details,
        source_label: publicDisclosure.source_label,
        source_checked_at: publicDisclosure.source_checked_at,
        is_unclaimed_profile: publicDisclosure.is_unclaimed_profile,
        status_label: STATUS_LABELS[controlStatus] || STATUS_LABELS.directory,
        availability_label: availabilityLabel,
        service_confirmation_level: serviceConfirmationLevel(publicServices),
        services: publicServices,
        team,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
