import { controlledChatEligibility } from './controlledChatPolicy.js';
import { providerLeadIsHistorical, sanitizeProviderLeadForFreeInbox } from './providerLeadInboxPolicy.js';

// Callers authorize every location before providing any rows. No patient identity or
// contact fields belong in the inbox; details continue through the audited endpoint.
export function providerInboxRow({ lead, request, contact, response, conversation, entitlement }) {
  const row = sanitizeProviderLeadForFreeInbox(lead);
  const pro = entitlement?.plan_code === 'pro';
  const historical = providerLeadIsHistorical(lead);
  const bound = request?.id === lead.request_id && contact?.request_id === lead.request_id && contact?.status === 'active'
    && response?.lead_id === lead.id && response?.location_id === lead.location_id
    && response?.request_id === lead.request_id;
  const chatAllowed = pro && bound && controlledChatEligibility({ lead, request, contact, response, entitlement }).eligible;
  const historyAllowed = historical && pro && entitlement?.feature_keys?.includes('provider_chat.access')
    && lead.access_tier === 'pro_full' && lead.result_bucket_snapshot === 'top3'
    && request?.id === lead.request_id && response?.lead_id === lead.id
    && response?.location_id === lead.location_id && response?.request_id === lead.request_id
    && ['can_help', 'needs_details'].includes(response?.response_type);
  const sameConversation = conversation?.lead_id === lead.id
    && conversation?.location_id === lead.location_id && conversation?.request_id === lead.request_id;
  const eligibleResponse = pro && (response?.status === 'active' || historical) && response?.lead_id === lead.id
    && response?.location_id === lead.location_id && response?.request_id === lead.request_id ? {
    response_type: response.response_type,
    response_label: { can_help: 'Putem ajuta', needs_details: 'Detalii necesare', cannot_help: 'Nu putem ajuta' }[response.response_type] || '',
  } : null;
  return {
    ...row,
    access_tier: pro && lead.access_tier === 'pro_full' && lead.result_bucket_snapshot === 'top3' ? 'pro_full' : 'free_preview',
    provider_response: eligibleResponse,
    chat_summary: (chatAllowed || historyAllowed) && sameConversation ? {
      conversation_id: conversation.id,
      status: conversation.status === 'open' ? 'open' : 'closed',
      last_message_at: conversation.last_message_at || null,
      unread_count: historical ? 0 : Math.max(0, Number(conversation.provider_unread_count) || 0),
      last_message_preview: '',
    } : null,
  };
}

function searchable(row) {
  return [row.intent_label, row.preview_summary, row.city, row.county, row.location_name]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro');
}

export function buildProviderInboxPage(rows, { scope = 'active', status = '', unread_only = false, search = '', offset = 0, limit = 50 } = {}) {
  const query = String(search || '').trim().slice(0, 120).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro');
  const requestedStatus = ['new', 'viewed', 'interested', 'needs_details', 'declined'].includes(status) ? status : '';
  const filtered = rows.filter(row => providerLeadIsHistorical(row) === (scope === 'history'))
    .filter(row => !requestedStatus || row.status === requestedStatus)
    .filter(row => !unread_only || Number(row.chat_summary?.unread_count) > 0)
    .filter(row => !query || searchable(row).includes(query))
    .sort((a, b) => String(b.chat_summary?.last_message_at || b.created_date || '').localeCompare(String(a.chat_summary?.last_message_at || a.created_date || '')) || String(b.id).localeCompare(String(a.id)));
  const size = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));
  const requestedOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const start = Math.min(requestedOffset, Math.max(0, Math.ceil(filtered.length / size) - 1) * size);
  return {
    leads: filtered.slice(start, start + size),
    pagination: { offset: start, limit: size, total: filtered.length, has_more: start + size < filtered.length },
    unread_conversations: rows.filter(row => Number(row.chat_summary?.unread_count) > 0).length,
  };
}
