import {
  DIRECTORY_CONTROL_STATUS,
  DIRECTORY_DETAIL_LEVEL,
  deriveCanonicalDetailLevel,
  deriveCanonicalDirectoryState,
  directorySourceCheckedAt,
} from './directoryCanonicalModel.js';

export function derivePublicProfileControlStatus(location = {}) {
  return deriveCanonicalDirectoryState(location).control_status;
}

function detailLevelFor(location, canonicalState, statusOverride) {
  if (!statusOverride) return canonicalState.directory_detail_level;
  if (statusOverride === DIRECTORY_CONTROL_STATUS.SUSPENDED) return DIRECTORY_DETAIL_LEVEL.SUMMARY;
  if ([DIRECTORY_CONTROL_STATUS.CLAIMED, DIRECTORY_CONTROL_STATUS.VERIFIED].includes(statusOverride)) {
    return DIRECTORY_DETAIL_LEVEL.FULL;
  }
  return deriveCanonicalDetailLevel({ ...location, control_status: statusOverride }, statusOverride, canonicalState.data_quality_status);
}

export function getPublicLocationDisclosure(location = {}, statusOverride = null) {
  const canonicalState = deriveCanonicalDirectoryState(location);
  const profileControlStatus = statusOverride || canonicalState.control_status;
  const publicDetailLevel = detailLevelFor(location, canonicalState, statusOverride);
  const exposeBasicDetails = [DIRECTORY_DETAIL_LEVEL.BASIC, DIRECTORY_DETAIL_LEVEL.FULL].includes(publicDetailLevel)
    && profileControlStatus !== DIRECTORY_CONTROL_STATUS.SUSPENDED;
  const exposeFullDetails = publicDetailLevel === DIRECTORY_DETAIL_LEVEL.FULL
    && profileControlStatus !== DIRECTORY_CONTROL_STATUS.SUSPENDED;
  const isDirectoryProfile = profileControlStatus === DIRECTORY_CONTROL_STATUS.DIRECTORY;

  return {
    profile_control_status: profileControlStatus,
    control_status: profileControlStatus,
    publication_status: canonicalState.publication_status,
    operational_status: canonicalState.operational_status,
    data_quality_status: canonicalState.data_quality_status,
    organization_link_status: canonicalState.organization_link_status,
    location_type_code: canonicalState.location_type_code,
    care_setting_code: canonicalState.care_setting_code,
    ownership_type_code: canonicalState.ownership_type_code,
    public_detail_level: publicDetailLevel,
    exact_location_visible: exposeFullDetails,
    contact_details_visible: exposeBasicDetails,
    address: exposeBasicDetails ? (location.address || null) : null,
    lat: exposeFullDetails ? (location.lat ?? null) : null,
    lng: exposeFullDetails ? (location.lng ?? null) : null,
    place_id: exposeFullDetails ? (location.place_id || null) : null,
    phone: exposeBasicDetails ? (location.public_phone || location.phone_public || null) : null,
    public_email: exposeFullDetails ? (location.public_email || null) : null,
    website: exposeBasicDetails ? (location.website_url || location.website || null) : null,
    opening_hours: exposeFullDetails ? (location.opening_hours || null) : null,
    saturday_hours: exposeFullDetails ? (location.saturday_hours || null) : null,
    opening_hours_json: exposeFullDetails ? (location.opening_hours_json || null) : null,
    source_label: isDirectoryProfile ? 'Sursa publica' : null,
    source_checked_at: isDirectoryProfile ? directorySourceCheckedAt(location) : null,
    is_unclaimed_profile: isDirectoryProfile,
    is_publicly_available: canonicalState.is_publicly_available,
    expose_basic_details: exposeBasicDetails,
    expose_full_details: exposeFullDetails,
  };
}

export const PUBLIC_PROFILE_STATUS = DIRECTORY_CONTROL_STATUS;
