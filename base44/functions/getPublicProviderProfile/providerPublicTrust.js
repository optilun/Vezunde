const PROFILE_STATUS = Object.freeze({
  DIRECTORY: 'directory',
  CLAIMED: 'claimed',
  VERIFIED: 'verified',
  SUSPENDED: 'suspended',
});

function clean(value) {
  return String(value || '').trim().toLowerCase();
}

export function derivePublicProfileControlStatus(location = {}) {
  const configuredStatus = clean(location.profile_control_status);
  const claimStatus = clean(location.claim_verification_status);
  const verificationState = clean(location.verification_state);
  const recordStatus = clean(location.status);
  const activeStatus = clean(location.active_status);

  if (
    configuredStatus === PROFILE_STATUS.SUSPENDED
    || verificationState === PROFILE_STATUS.SUSPENDED
    || recordStatus === 'suspendata'
    || activeStatus === 'inactiva'
  ) {
    return PROFILE_STATUS.SUSPENDED;
  }

  const hasVerifiedState = verificationState === PROFILE_STATUS.VERIFIED
    && location.is_verified === true;
  const hasVerificationEvidence = claimStatus === 'approved'
    || Boolean(String(location.last_verified_at || '').trim());

  if (
    configuredStatus === PROFILE_STATUS.VERIFIED
    && hasVerifiedState
    && hasVerificationEvidence
  ) {
    return PROFILE_STATUS.VERIFIED;
  }

  const isProviderAdministered = configuredStatus === PROFILE_STATUS.CLAIMED
    || ['pending', 'approved'].includes(claimStatus)
    || ['in_verification', 'verified'].includes(verificationState)
    || clean(location.data_source) === 'claim';

  return isProviderAdministered ? PROFILE_STATUS.CLAIMED : PROFILE_STATUS.DIRECTORY;
}

export function getPublicLocationDisclosure(location = {}, statusOverride = null) {
  const profileControlStatus = statusOverride || derivePublicProfileControlStatus(location);
  const isDirectorySummary = profileControlStatus === PROFILE_STATUS.DIRECTORY;
  const exposeFullDetails = !isDirectorySummary && profileControlStatus !== PROFILE_STATUS.SUSPENDED;

  return {
    profile_control_status: profileControlStatus,
    public_detail_level: isDirectorySummary ? 'summary' : 'full',
    exact_location_visible: exposeFullDetails,
    contact_details_visible: exposeFullDetails,
    address: exposeFullDetails ? (location.address || null) : null,
    lat: exposeFullDetails ? (location.lat ?? null) : null,
    lng: exposeFullDetails ? (location.lng ?? null) : null,
    place_id: exposeFullDetails ? (location.place_id || null) : null,
    phone: exposeFullDetails ? (location.public_phone || location.phone_public || null) : null,
    public_email: exposeFullDetails ? (location.public_email || null) : null,
    website: exposeFullDetails ? (location.website_url || location.website || null) : null,
    opening_hours: exposeFullDetails ? (location.opening_hours || null) : null,
    saturday_hours: exposeFullDetails ? (location.saturday_hours || null) : null,
    opening_hours_json: exposeFullDetails ? (location.opening_hours_json || null) : null,
    expose_full_details: exposeFullDetails,
  };
}

export const PUBLIC_PROFILE_STATUS = PROFILE_STATUS;

