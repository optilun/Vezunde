import {
  PATIENT_REQUEST_LIFECYCLE_STATES,
  patientRequestHasExpired,
  persistedPatientRequestLifecycleState,
} from './patientRequestLifecyclePolicy.js';

export const CONTROLLED_CHAT_CONTRACT_VERSION = 'controlled-pro-chat-v1';
export const CONTROLLED_CHAT_MESSAGE_CONTRACT_VERSION = 'controlled-chat-message-v1';
export const CONTROLLED_CHAT_REQUIRED_DISTRIBUTION_CONSENT_VERSION = 'patient-request-distribution-top3-pro-v2';
// 2026-09-01: acordul de distribuire a trecut pe v3 (adauga mesajul de deschidere la lista
// de campuri livrate). Chatul controlat nu si-a schimbat scopul, deci accepta ambele
// versiuni; altfel cererile noi ar fi pierdut chatul fara niciun motiv real.
export const CONTROLLED_CHAT_SUPPORTED_DISTRIBUTION_CONSENT_VERSIONS = Object.freeze([
  'patient-request-distribution-top3-pro-v2',
  'patient-request-distribution-top3-pro-v3',
]);
export const CONTROLLED_CHAT_MAX_MESSAGE_LENGTH = 1200;
export const CONTROLLED_CHAT_MAX_MESSAGES_PER_HOUR = 30;

const ALLOWED_RESPONSE_TYPES = new Set(['can_help', 'needs_details']);
const CLOSED_LEAD_STATUSES = new Set(['declined', 'closed', 'expired']);
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;
const PHONE_CANDIDATE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;

/** @param {unknown} value @param {number} [maxLength] */
function clean(value, maxLength = CONTROLLED_CHAT_MAX_MESSAGE_LENGTH + 1) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/** @param {unknown} value */
function containsPhone(value) {
  /** @type {string[]} */
  const matches = String(value || '').match(PHONE_CANDIDATE_PATTERN) || [];
  return matches.some((candidate) => candidate.replace(/\D/g, '').length >= 9);
}

export function validateControlledChatMessage(value) {
  const body = clean(value);
  const reasons = [];
  if (body.length < 2) reasons.push('message_too_short');
  if (body.length > CONTROLLED_CHAT_MAX_MESSAGE_LENGTH) reasons.push('message_too_long');
  if (EMAIL_PATTERN.test(body)) reasons.push('email_not_allowed');
  if (containsPhone(body)) reasons.push('phone_not_allowed');
  if (URL_PATTERN.test(body)) reasons.push('link_not_allowed');
  return { valid: reasons.length === 0, reasons, body };
}

export function controlledChatEligibility({ request, lead, response, entitlement, contact, conversation = null }) {
  const reasons = [];
  const lifecycleState = persistedPatientRequestLifecycleState(request);
  if (!request || lifecycleState !== PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE || patientRequestHasExpired(request)) {
    reasons.push('request_lifecycle_not_active');
  }
  if (!lead || lead.delivery_state !== 'available') reasons.push('lead_not_available');
  if (lead && CLOSED_LEAD_STATUSES.has(lead.status)) reasons.push('lead_status_not_eligible');
  if (lead?.result_bucket_snapshot !== 'top3' || lead?.access_tier !== 'pro_full') reasons.push('lead_not_top3');
  if (!response || response.status !== 'active' || !ALLOWED_RESPONSE_TYPES.has(response.response_type)) {
    reasons.push('provider_response_not_eligible');
  }
  if (entitlement?.plan_code !== 'pro' || !entitlement?.feature_keys?.includes('provider_chat.access')) {
    reasons.push('provider_chat_entitlement_required');
  }
  if (contact?.provider_request_distribution_consent !== true) reasons.push('distribution_consent_missing');
  if (
    contact?.provider_request_distribution_consent === true
    && !CONTROLLED_CHAT_SUPPORTED_DISTRIBUTION_CONSENT_VERSIONS.includes(
      contact?.provider_request_distribution_consent_version,
    )
  ) {
    reasons.push('distribution_consent_version_outdated');
  }
  if (conversation?.status === 'closed') reasons.push('conversation_closed');
  return { eligible: reasons.length === 0, reasons };
}

// lastOwnMessageSeen: indicatorul "Vazut" pentru ultimul mesaj trimis de cel care priveste.
// Expunem intentionat DOAR un boolean derivat, calculat pe server, nu momentul in care
// celalalt a citit: destinatarul afla ca mesajul lui a ajuns sub ochii partenerului, fara sa
// primeasca un istoric al activitatii acestuia.
export function sanitizeControlledChatConversation(conversation, { canOpen = false, canSend = false, unreadCount = 0, lastOwnMessageSeen = false } = {}) {
  return {
    id: String(conversation?.id || '').slice(0, 120),
    status: conversation?.status === 'open' ? 'open' : (conversation?.status === 'closed' ? 'closed' : 'not_opened'),
    can_open: canOpen === true,
    can_send: canSend === true,
    opened_at: conversation?.opened_at || null,
    closed_at: conversation?.closed_at || null,
    last_message_at: conversation?.last_message_at || null,
    unread_count: Math.max(0, Number(unreadCount) || 0),
    last_own_message_seen: lastOwnMessageSeen === true,
    contact_fields_blocked: true,
  };
}

export function sanitizeControlledChatMessage(message) {
  return {
    id: String(message?.id || '').slice(0, 120),
    sender_type: message?.sender_type === 'provider' ? 'provider' : 'patient',
    body: clean(message?.body, CONTROLLED_CHAT_MAX_MESSAGE_LENGTH),
    sent_at: message?.sent_at || message?.created_date || null,
  };
}

export function controlledChatRateLimitState(messages, senderType, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(String(now));
  const threshold = (Number.isFinite(nowMs) ? nowMs : Date.now()) - (60 * 60 * 1000);
  const recentCount = (Array.isArray(messages) ? messages : []).filter((message) => {
    if (message?.sender_type !== senderType || message?.status !== 'active') return false;
    const timestamp = Date.parse(String(message?.sent_at || message?.created_date || ''));
    return Number.isFinite(timestamp) && timestamp >= threshold;
  }).length;
  return {
    allowed: recentCount < CONTROLLED_CHAT_MAX_MESSAGES_PER_HOUR,
    recent_count: recentCount,
    remaining: Math.max(0, CONTROLLED_CHAT_MAX_MESSAGES_PER_HOUR - recentCount),
  };
}
