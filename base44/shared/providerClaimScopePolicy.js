export const PROVIDER_CLAIM_SCOPE_CONTRACT_VERSION = 'provider-claim-scope-v1';

export const PROVIDER_CLAIM_SCOPES = Object.freeze({
  LOCATION: 'location',
  SELECTED_LOCATIONS: 'selected_locations',
  ORGANIZATION: 'organization',
});

export const PROVIDER_CLAIM_SCOPE_LABELS = Object.freeze({
  location: 'O singura locatie',
  selected_locations: 'Mai multe locatii selectate',
  organization: 'Organizatia si locatiile confirmate',
});

export const PROVIDER_CLAIM_RELATIONSHIPS = Object.freeze([
  'owner',
  'organization_representative',
  'location_manager',
  'authorized_staff',
]);

export const PROVIDER_CLAIM_MEMBER_ROLES = Object.freeze([
  'organization_owner',
  'location_manager',
  'location_staff',
]);

const ORGANIZATION_RELATIONSHIPS = new Set(['owner', 'organization_representative']);
const LOCATION_SCOPES = new Set([
  PROVIDER_CLAIM_SCOPES.LOCATION,
  PROVIDER_CLAIM_SCOPES.SELECTED_LOCATIONS,
]);
const VALID_SCOPES = new Set(Object.values(PROVIDER_CLAIM_SCOPES));
const VALID_RELATIONSHIPS = new Set(PROVIDER_CLAIM_RELATIONSHIPS);
const VALID_ROLES = new Set(PROVIDER_CLAIM_MEMBER_ROLES);

function clean(value) {
  return String(value || '').trim();
}

export function uniqueClaimLocationIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];
}

export function isOrganizationClaimRelationship(relationship) {
  return ORGANIZATION_RELATIONSHIPS.has(clean(relationship));
}

export function requestedRoleForClaimScope(relationship, claimScope) {
  const normalizedRelationship = clean(relationship);
  const normalizedScope = clean(claimScope);
  if (normalizedScope === PROVIDER_CLAIM_SCOPES.ORGANIZATION && isOrganizationClaimRelationship(normalizedRelationship)) {
    return 'organization_owner';
  }
  if (normalizedRelationship === 'authorized_staff') return 'location_staff';
  return 'location_manager';
}

export function allowedRolesForClaimScope(claimScope) {
  return clean(claimScope) === PROVIDER_CLAIM_SCOPES.ORGANIZATION
    ? [...PROVIDER_CLAIM_MEMBER_ROLES]
    : ['location_manager', 'location_staff'];
}

export function isApprovedRoleAllowed(claimScope, relationship, role) {
  const normalizedRole = clean(role);
  if (!VALID_ROLES.has(normalizedRole)) return false;
  if (normalizedRole === 'organization_owner') {
    return clean(claimScope) === PROVIDER_CLAIM_SCOPES.ORGANIZATION
      && isOrganizationClaimRelationship(relationship);
  }
  return true;
}

export function normalizeClaimScopeSelection(input = {}) {
  const primaryLocationId = clean(input.primaryLocationId);
  const organizationId = clean(input.organizationId);
  const relationship = clean(input.relationship);
  const claimScope = VALID_SCOPES.has(clean(input.claimScope))
    ? clean(input.claimScope)
    : PROVIDER_CLAIM_SCOPES.LOCATION;
  const candidateLocationIds = uniqueClaimLocationIds(input.candidateLocationIds);
  const candidateSet = new Set(candidateLocationIds);
  const requestedRaw = uniqueClaimLocationIds(input.requestedLocationIds);
  const excludedRaw = uniqueClaimLocationIds(input.excludedLocationIds);

  if (!primaryLocationId || !candidateSet.has(primaryLocationId)) {
    return { ok: false, error: 'Locatia principala nu apartine setului disponibil.' };
  }
  if (!VALID_RELATIONSHIPS.has(relationship)) {
    return { ok: false, error: 'Relatia solicitantului nu este valida.' };
  }
  if (claimScope !== PROVIDER_CLAIM_SCOPES.LOCATION && !organizationId) {
    return { ok: false, error: 'Mai multe locatii pot fi solicitate numai in cadrul unei organizatii existente.' };
  }
  if (claimScope === PROVIDER_CLAIM_SCOPES.ORGANIZATION && !isOrganizationClaimRelationship(relationship)) {
    return { ok: false, error: 'Administrarea organizatiei poate fi solicitata doar de proprietar sau reprezentant autorizat.' };
  }

  let requestedLocationIds;
  if (claimScope === PROVIDER_CLAIM_SCOPES.LOCATION) {
    requestedLocationIds = [primaryLocationId];
  } else {
    requestedLocationIds = requestedRaw.filter((locationId) => candidateSet.has(locationId));
    if (!requestedLocationIds.includes(primaryLocationId)) requestedLocationIds.unshift(primaryLocationId);
  }
  requestedLocationIds = uniqueClaimLocationIds(requestedLocationIds);

  if (claimScope === PROVIDER_CLAIM_SCOPES.SELECTED_LOCATIONS && requestedLocationIds.length < 2) {
    return { ok: false, error: 'Selecteaza cel putin doua locatii pentru o solicitare multi-location.' };
  }
  if (requestedLocationIds.length === 0) {
    return { ok: false, error: 'Selecteaza cel putin o locatie.' };
  }
  if (requestedLocationIds.some((locationId) => !candidateSet.has(locationId))) {
    return { ok: false, error: 'Solicitarea contine o locatie care nu apartine organizatiei selectate.' };
  }

  const requestedSet = new Set(requestedLocationIds);
  const excludedLocationIds = uniqueClaimLocationIds([
    ...excludedRaw.filter((locationId) => candidateSet.has(locationId) && !requestedSet.has(locationId)),
    ...candidateLocationIds.filter((locationId) => !requestedSet.has(locationId)),
  ]);

  if (claimScope === PROVIDER_CLAIM_SCOPES.ORGANIZATION) {
    const accountedFor = new Set([...requestedLocationIds, ...excludedLocationIds]);
    if (candidateLocationIds.some((locationId) => !accountedFor.has(locationId))) {
      return { ok: false, error: 'Confirma pentru fiecare locatie daca apartine sau nu organizatiei.' };
    }
  }

  return {
    ok: true,
    claim_scope: claimScope,
    organization_id: organizationId || null,
    primary_location_id: primaryLocationId,
    requested_location_ids: requestedLocationIds,
    excluded_location_ids: excludedLocationIds,
    requested_membership_role: requestedRoleForClaimScope(relationship, claimScope),
    reported_missing_location: clean(input.reportedMissingLocation).slice(0, 1000),
  };
}

export function claimLocationIdsFromPayload(claim = {}, payload = {}) {
  const requested = uniqueClaimLocationIds(payload.requested_location_ids);
  if (requested.length > 0) return requested;
  const locationId = clean(claim.location_id || payload.location_id);
  return locationId ? [locationId] : [];
}

export function isLocationScopedClaimScope(claimScope) {
  return LOCATION_SCOPES.has(clean(claimScope));
}
