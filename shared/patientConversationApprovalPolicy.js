export const PATIENT_CONVERSATION_APPROVAL_CONTRACT_VERSION = 'patient-conversation-approval-v1';
export const PROVIDER_CONVERSATION_CONTRACT_VERSION = 'provider-conversation-v1';

const APPROVABLE_RESPONSE_TYPES = new Set(['can_help', 'needs_details']);

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

export function canApprovePatientConversation(response) {
  return response?.status === 'active'
    && APPROVABLE_RESPONSE_TYPES.has(clean(response?.response_type, 80));
}

export function sanitizePatientConversationApproval(approval, conversation = null, locationId = '') {
  const approved = approval?.status === 'approved';
  const conversationStatus = clean(conversation?.status, 80);
  return {
    location_id: clean(approval?.location_id || conversation?.location_id || locationId, 120),
    status: approved ? 'approved' : 'revoked',
    approved_at: approved ? (approval?.approved_at || null) : null,
    revoked_at: approved ? null : (approval?.revoked_at || null),
    conversation_status: approved && conversationStatus === 'active' ? 'active' : 'locked',
  };
}

export function patientConversationAvailable(approval, conversation) {
  return approval?.status === 'approved' && conversation?.status === 'active';
}
