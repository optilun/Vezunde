function clean(value) {
  return String(value || '').trim();
}

function isFullOrganizationApproval(scope) {
  const candidateCount = Math.max(0, Number(scope?.candidate_location_count) || 0);
  const approvedCount = Math.max(0, Number(scope?.approved_location_count) || 0);
  const excludedCount = Math.max(0, Number(scope?.excluded_location_count) || 0);
  return clean(scope?.claim_scope) === 'organization'
    && clean(scope?.approved_membership_role) === 'organization_owner'
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
    if (clean(scope.claim_scope) !== 'organization' || clean(scope.approved_membership_role) !== 'organization_owner') continue;
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
  if (!membership || clean(membership.role) !== 'organization_owner' || clean(membership.status) !== 'active') return false;
  if (membership.organization_wide_access === true) return true;
  if (membership.organization_wide_access === false) return false;
  const userId = clean(membership.user_id);
  if (resolution?.wideUserIds?.has(userId)) return true;
  if (resolution?.restrictedUserIds?.has(userId)) return false;
  return true;
}

export function organizationApprovalIsWide(scope) {
  return isFullOrganizationApproval(scope);
}
