import {
  PROVIDER_ADMIN_ROLE,
  PROVIDER_OWNER_ROLE,
  providerAccessRoleFromMembership,
} from './providerRolePolicy.js';

function clean(value) {
  return String(value || '').trim();
}

// 2026-10-03 (structura conturilor, pasul 3): rolurile si citirea rolului dintr-un membership vin
// din providerRolePolicy.js, sursa unica a matricei de drepturi.
export const ORGANIZATION_OWNER_ROLE = PROVIDER_OWNER_ROLE;
export const ORGANIZATION_ADMIN_ROLE = PROVIDER_ADMIN_ROLE;

export function providerMembershipAccessRole(membership) {
  return providerAccessRoleFromMembership(membership);
}

export function storedProviderRoleForAccessRole(role) {
  const normalized = clean(role);
  if (normalized === ORGANIZATION_ADMIN_ROLE) return 'location_manager';
  if (normalized === 'owner') return ORGANIZATION_OWNER_ROLE;
  if (normalized === 'manager') return 'location_manager';
  if (normalized === 'staff') return 'location_staff';
  return normalized;
}

export function organizationRoleMarkerForAccessRole(role) {
  return clean(role) === ORGANIZATION_ADMIN_ROLE ? ORGANIZATION_ADMIN_ROLE : '';
}

export function isPrivilegedProviderRole(role) {
  const normalized = clean(role);
  return normalized === ORGANIZATION_OWNER_ROLE || normalized === ORGANIZATION_ADMIN_ROLE;
}

export function roleRequiresOrganizationWideAccess(role) {
  return clean(role) === ORGANIZATION_ADMIN_ROLE;
}

export function isOrganizationWideProviderRole(role) {
  return roleRequiresOrganizationWideAccess(role);
}

function isFullOrganizationApproval(scope) {
  const candidateCount = Math.max(0, Number(scope?.candidate_location_count) || 0);
  const approvedCount = Math.max(0, Number(scope?.approved_location_count) || 0);
  const excludedCount = Math.max(0, Number(scope?.excluded_location_count) || 0);
  return clean(scope?.claim_scope) === 'organization'
    && clean(scope?.approved_membership_role) === ORGANIZATION_OWNER_ROLE
    && clean(scope?.approval_status) === 'approved'
    && candidateCount > 0
    && approvedCount === candidateCount
    && excludedCount === 0;
}

export async function loadOrganizationOwnerScopeResolution(svc, organizationId) {
  const normalizedOrganizationId = clean(organizationId);
  const wideUserIds = new Set();
  const restrictedUserIds = new Set();
  if (!normalizedOrganizationId) return { wideUserIds, restrictedUserIds };

  const scopes = await svc.entities.ProviderClaimScopeSelection.filter({
    organization_id: normalizedOrganizationId,
    approval_status: 'approved',
    selection_status: 'active',
  }, '-reviewed_at', 500).catch(() => []);

  for (const scope of scopes) {
    if (clean(scope.claim_scope) !== 'organization' || clean(scope.approved_membership_role) !== ORGANIZATION_OWNER_ROLE) continue;
    const claim = await svc.entities.ProviderClaimRequest.get(scope.claim_request_id).catch(() => null);
    const userId = clean(claim?.user_id);
    if (!userId) continue;
    if (isFullOrganizationApproval(scope)) wideUserIds.add(userId);
    else restrictedUserIds.add(userId);
  }

  for (const userId of wideUserIds) restrictedUserIds.delete(userId);
  return { wideUserIds, restrictedUserIds };
}

export function membershipHasOrganizationWideAccess(membership, resolution = {}) {
  if (!membership || clean(membership.status) !== 'active') return false;
  const accessRole = providerMembershipAccessRole(membership);
  if (!isPrivilegedProviderRole(accessRole)) return false;
  if (membership.organization_wide_access === true) return true;
  if (membership.organization_wide_access === false) return false;
  if (accessRole === ORGANIZATION_ADMIN_ROLE) return false;
  const userId = clean(membership.user_id);
  if (resolution?.wideUserIds?.has(userId)) return true;
  if (resolution?.restrictedUserIds?.has(userId)) return false;
  return true;
}

export function organizationApprovalIsWide(scope) {
  return isFullOrganizationApproval(scope);
}

/**
 * Cine primeste acces la o locatie noua sau nou asociata unei organizatii.
 *
 * 2026-10-03. Doar ownerii si administratorii cu acces la intreaga organizatie primesc locatia,
 * cu `organization_wide_access: true` scris explicit. Un owner limitat la anumite locatii nu mai
 * primeste un rand fara flag (care ar fi contat ca acces la toata organizatia si l-ar fi extins,
 * prin sincronizare, la toate locatiile). Daca solicitantul e un owner limitat, primeste doar
 * locatia ceruta, cu `organization_wide_access: false`.
 * Intoarce lista schimbarilor de aplicat: { user_id, existing, desired }.
 */
export function planNewLocationAccess({ memberships = [], resolution = {}, organizationId, locationId, requesterUserId = '' } = {}) {
  const normalizedOrganizationId = clean(organizationId);
  const normalizedLocationId = clean(locationId);
  const organizationRows = memberships.filter((membership) => clean(membership?.organization_id) === normalizedOrganizationId);
  const rolesByUser = new Map();
  for (const membership of organizationRows) {
    if (!membershipHasOrganizationWideAccess(membership, resolution)) continue;
    const userId = clean(membership.user_id);
    if (!userId) continue;
    const roles = rolesByUser.get(userId) || [];
    roles.push(providerMembershipAccessRole(membership));
    rolesByUser.set(userId, roles);
  }

  const existingFor = (userId) => organizationRows.find((membership) => clean(membership.user_id) === userId && clean(membership.location_id) === normalizedLocationId)
    || memberships.find((membership) => clean(membership.user_id) === userId && clean(membership.location_id) === normalizedLocationId)
    || null;
  const plan = [];
  for (const [userId, roles] of rolesByUser.entries()) {
    const accessRole = roles.includes(ORGANIZATION_OWNER_ROLE) ? ORGANIZATION_OWNER_ROLE : ORGANIZATION_ADMIN_ROLE;
    const existing = existingFor(userId);
    plan.push({
      user_id: userId,
      existing,
      desired: {
        organization_id: normalizedOrganizationId,
        role: storedProviderRoleForAccessRole(accessRole),
        organization_role: accessRole === ORGANIZATION_ADMIN_ROLE ? ORGANIZATION_ADMIN_ROLE : 'none',
        status: 'active',
        access_origin: existing?.access_origin || 'organization_sync',
        claim_scope: 'organization',
        organization_wide_access: true,
      },
    });
  }

  const requester = clean(requesterUserId);
  const requesterIsOwner = requester && organizationRows.some((membership) => clean(membership.user_id) === requester
    && clean(membership.status) === 'active'
    && providerMembershipAccessRole(membership) === ORGANIZATION_OWNER_ROLE);
  if (requesterIsOwner && !rolesByUser.has(requester)) {
    const existing = existingFor(requester);
    plan.push({
      user_id: requester,
      existing,
      desired: {
        organization_id: normalizedOrganizationId,
        role: storedProviderRoleForAccessRole(ORGANIZATION_OWNER_ROLE),
        organization_role: 'none',
        status: 'active',
        access_origin: existing?.access_origin || 'organization_sync',
        claim_scope: 'location',
        organization_wide_access: false,
      },
    });
  }
  return plan;
}

/** Un rand existent trebuie actualizat daca nu e activ sau difera de ce s-a planificat. */
export function plannedAccessNeedsUpdate(existing, desired) {
  if (!existing) return true;
  return clean(existing.status) !== 'active'
    || providerMembershipAccessRole(existing) !== providerMembershipAccessRole(desired)
    || existing.organization_wide_access !== desired.organization_wide_access
    || clean(existing.organization_id) !== clean(desired.organization_id);
}
