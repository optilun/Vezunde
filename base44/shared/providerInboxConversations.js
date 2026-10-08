import { providerInboxRow } from './providerInboxConversationPolicy.js';
import { sanitizeControlledChatMessage } from './controlledChatPolicy.js';

export async function readAllInboxRows(entity, query, sort = '-created_date') {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const page = await entity.filter(query, sort, 500, offset);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

async function readByIds(entity, field, ids, extra = {}, sort = '-updated_date') {
  const rows = [];
  for (let index = 0; index < ids.length; index += 50) {
    rows.push(...await readAllInboxRows(entity, { ...extra, [field]: { $in: ids.slice(index, index + 50) } }, sort));
  }
  return rows;
}

function firstBy(rows, key) {
  const map = new Map();
  for (const row of rows) if (!map.has(row[key])) map.set(row[key], row);
  return map;
}

export async function projectProviderInboxRows(svc, leads, entitlements) {
  const proLeads = leads.filter(lead => entitlements[lead.location_id]?.plan_code === 'pro');
  const ids = proLeads.map(lead => lead.id);
  const requestIds = [...new Set(proLeads.filter(lead => lead.access_tier === 'pro_full' && lead.result_bucket_snapshot === 'top3').map(lead => lead.request_id).filter(Boolean))];
  const [requests, contacts, responses, conversations] = await Promise.all([
    readByIds(svc.entities.PatientRequest, 'id', requestIds),
    readByIds(svc.entities.PatientRequestContact, 'request_id', requestIds, { status: 'active' }),
    readByIds(svc.entities.ProviderLeadResponse, 'lead_id', ids),
    readByIds(svc.entities.PatientRequestConversation, 'lead_id', ids),
  ]);
  const requestMap = firstBy(requests, 'id');
  const contactMap = firstBy(contacts, 'request_id');
  const responseMap = firstBy(responses, 'lead_id');
  const conversationMap = firstBy(conversations, 'lead_id');
  return leads.map(lead => providerInboxRow({
    lead, request: requestMap.get(lead.request_id), contact: contactMap.get(lead.request_id),
    response: responseMap.get(lead.id), conversation: conversationMap.get(lead.id), entitlement: entitlements[lead.location_id],
  }));
}

// Only fetch bodies for the selected page, after eligibility was established.
export async function addInboxMessagePreviews(svc, rows) {
  let next = 0;
  const output = [...rows];
  const worker = async () => {
    while (next < rows.length) {
      const index = next++;
      const row = rows[index];
      if (!row.chat_summary) continue;
      const messages = await svc.entities.PatientRequestMessage.filter({
        conversation_id: row.chat_summary.conversation_id, location_id: row.location_id,
        lead_id: row.id, status: 'active',
      }, '-sent_at', 1);
      const message = messages[0];
      output[index] = { ...row, chat_summary: { ...row.chat_summary,
        last_message_preview: message ? sanitizeControlledChatMessage(message).body.slice(0, 160) : '',
        last_message_sender_type: message?.sender_type === 'provider' ? 'provider' : 'patient',
      } };
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker));
  return output;
}
