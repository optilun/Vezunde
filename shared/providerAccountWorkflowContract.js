export const PROVIDER_REVIEW_STATUSES = Object.freeze([
  'draft',
  'pending_review',
  'needs_more_info',
  'approved',
  'rejected',
  'withdrawn',
]);

export const PROVIDER_REVIEW_ACTIONS = Object.freeze({
  SAVE_DRAFT: 'save_draft',
  SUBMIT: 'submit',
  REQUEST_MORE_INFO: 'request_more_info',
  APPROVE: 'approve',
  REJECT: 'reject',
  WITHDRAW: 'withdraw',
});

const TRANSITIONS = Object.freeze({
  draft: Object.freeze({
    submit: 'pending_review',
    withdraw: 'withdrawn',
  }),
  pending_review: Object.freeze({
    request_more_info: 'needs_more_info',
    approve: 'approved',
    reject: 'rejected',
    withdraw: 'withdrawn',
  }),
  needs_more_info: Object.freeze({
    save_draft: 'draft',
    submit: 'pending_review',
    withdraw: 'withdrawn',
  }),
  approved: Object.freeze({}),
  rejected: Object.freeze({}),
  withdrawn: Object.freeze({}),
});

export function normalizeWorkflowStatus(value) {
  const status = String(value || '').trim();
  return PROVIDER_REVIEW_STATUSES.includes(status) ? status : '';
}

export function nextProviderReviewStatus(currentStatus, action) {
  const current = normalizeWorkflowStatus(currentStatus);
  const normalizedAction = String(action || '').trim();
  if (!current) return { ok: false, error: 'Status curent invalid' };
  const next = TRANSITIONS[current]?.[normalizedAction] || '';
  if (!next) return { ok: false, error: `Tranzitie invalida: ${current} -> ${normalizedAction}` };
  return { ok: true, previous: current, action: normalizedAction, next };
}

export function reviewNoteRequirement(action, note) {
  const normalizedAction = String(action || '').trim();
  const normalizedNote = String(note || '').trim();
  const required = ['request_more_info', 'reject'].includes(normalizedAction);
  if (required && !normalizedNote) return { ok: false, error: 'Nota administrativa este obligatorie' };
  return { ok: true, required, note: normalizedNote };
}

export function simulateProviderReviewFlow(actions = []) {
  let status = 'draft';
  const history = [{ status, action: 'create_draft' }];
  for (const step of actions) {
    const action = typeof step === 'string' ? step : step?.action;
    const note = typeof step === 'object' ? step?.note : '';
    const noteCheck = reviewNoteRequirement(action, note);
    if (!noteCheck.ok) return { ok: false, status, history, error: noteCheck.error };
    const transition = nextProviderReviewStatus(status, action);
    if (!transition.ok) return { ok: false, status, history, error: transition.error };
    status = transition.next;
    history.push({ status, action, note: noteCheck.note });
  }
  return { ok: true, status, history };
}

export const PROVIDER_ACCOUNT_FLOW_CONTRACTS = Object.freeze({
  organization_profile: Object.freeze({
    providerFunction: 'manageProviderOrganizationProfile',
    adminFunction: 'adminOrganizationProfileReview',
    publicEntity: 'ProviderOrganization',
    supportsMoreInfo: true,
  }),
  location_details: Object.freeze({
    providerFunction: 'submitProviderWorkspaceChange',
    adminFunction: 'adminWorkspaceReview',
    publicEntity: 'ProviderLocation',
    supportsMoreInfo: true,
  }),
  services: Object.freeze({
    providerFunction: 'providerServiceConfigurationOps',
    adminFunction: 'adminServiceConfigurationReview',
    publicEntity: 'LocationService',
    supportsMoreInfo: true,
  }),
  location_photo: Object.freeze({
    providerFunction: 'locationPhotoOps',
    adminFunction: 'locationPhotoOps',
    publicEntity: 'ProviderLocation',
    supportsMoreInfo: true,
  }),
  location_lifecycle: Object.freeze({
    providerFunction: 'providerLocationLifecycleOps',
    adminFunction: 'providerLocationLifecycleOps',
    publicEntity: 'ProviderLocation',
    supportsMoreInfo: true,
  }),
  new_location: Object.freeze({
    providerFunction: 'providerLocationExpansionOps',
    adminFunction: 'providerLocationIdentityResolutionOps',
    publicEntity: 'ProviderLocation',
    supportsMoreInfo: true,
  }),
});
