import {
  PATIENT_CONVERSATION_AGENT_VERSION,
  buildPatientConversationAgentPrompt,
  buildPatientConversationShadowEnvelope,
  getPatientConversationAgentResponseSchema,
} from '../../shared/patientConversationAgent.js';

const PATIENT_CONVERSATION_SHADOW_EVENT = 'patient_conversation_agent_shadow_summary';

function clean(value: unknown, maxLength = 1200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function conversationFromPayload(payload: any) {
  if (Array.isArray(payload?.conversation)) return payload.conversation;
  const fallbackText = clean(
    payload?.search_text
    || payload?.query
    || payload?.free_text
    || payload?.search_query,
  );
  return fallbackText ? [{ role: 'user', content: fallbackText }] : [];
}

function runtimeContextFromPayload(payload: any) {
  const explicitRuntimeContext = payload?.runtime_context && typeof payload.runtime_context === 'object'
    ? payload.runtime_context
    : {};
  return {
    locale: clean(explicitRuntimeContext.locale, 20) || 'ro-RO',
    known_locality: explicitRuntimeContext.known_locality || {
      siruta_code: clean(payload?.locality_siruta_code, 40),
      city: clean(payload?.locality_name || payload?.locality_city, 120),
      county_code: clean(payload?.county_code, 40),
      county: clean(payload?.county_name, 120),
      area: clean(payload?.locality_area, 160),
    },
    contact_share_approved: explicitRuntimeContext.contact_share_approved === true,
  };
}

function emitShadowSummary(envelope: any) {
  const interpretation = envelope?.interpretation;
  console.info(PATIENT_CONVERSATION_SHADOW_EVENT, JSON.stringify({
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: envelope?.status || 'unknown',
    primary_intent: interpretation?.primary_intent || 'unknown',
    care_path_count: Array.isArray(interpretation?.care_path_candidates)
      ? interpretation.care_path_candidates.length
      : 0,
    service_count: Array.isArray(interpretation?.service_keys)
      ? interpretation.service_keys.length
      : 0,
    urgency_level: interpretation?.urgency?.level || 'unknown',
    next_action: interpretation?.next_action || null,
    sufficient_for_search: interpretation?.information_status?.sufficient_for_search === true,
  }));
}

export async function runPatientConversationAgentShadow(base44: any, payload: any = {}) {
  const conversation = conversationFromPayload(payload);
  const hasUserMessage = conversation.some((turn: any) => (
    turn?.role === 'user' && clean(turn?.content)
  ));

  if (!hasUserMessage) {
    const skipped = buildPatientConversationShadowEnvelope({
      status: 'skipped',
      reason: 'user_message_required',
    });
    emitShadowSummary(skipped);
    return skipped;
  }

  const prompt = buildPatientConversationAgentPrompt({
    conversation,
    priorState: payload?.prior_state,
    runtimeContext: runtimeContextFromPayload(payload),
  });

  try {
    const raw = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: getPatientConversationAgentResponseSchema(),
    });
    const completed = buildPatientConversationShadowEnvelope({
      status: 'completed',
      raw,
      conversation,
    });
    emitShadowSummary(completed);
    return completed;
  } catch (_error) {
    const unavailable = buildPatientConversationShadowEnvelope({
      status: 'unavailable',
      conversation,
      reason: 'conversation_model_unavailable',
    });
    emitShadowSummary(unavailable);
    return unavailable;
  }
}
