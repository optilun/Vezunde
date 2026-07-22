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

function cleanList(value: unknown, limit = 12, maxLength = 160) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => clean(item, maxLength))
      .filter(Boolean),
  )].slice(0, limit);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function sanitizeLocality(value: any) {
  const locality = isPlainObject(value) ? value : {};
  return {
    siruta_code: clean(locality.siruta_code, 40),
    city: clean(locality.city || locality.name, 120),
    county_code: clean(locality.county_code, 40),
    county: clean(locality.county || locality.county_name, 120),
    area: clean(locality.area, 160),
  };
}

function runtimeContextFromPayload(payload: any) {
  const explicitRuntimeContext = isPlainObject(payload?.runtime_context)
    ? payload.runtime_context
    : {};
  const explicitLocality = sanitizeLocality(explicitRuntimeContext.known_locality);
  const fallbackLocality = sanitizeLocality({
    siruta_code: payload?.locality_siruta_code,
    city: payload?.locality_name || payload?.locality_city,
    county_code: payload?.county_code,
    county: payload?.county_name,
    area: payload?.locality_area,
  });
  const hasExplicitLocality = Boolean(explicitLocality.siruta_code || explicitLocality.city);

  return {
    locale: clean(explicitRuntimeContext.locale, 20) || 'ro-RO',
    known_locality: hasExplicitLocality ? explicitLocality : fallbackLocality,
    contact_share_approved: explicitRuntimeContext.contact_share_approved === true,
  };
}

function sanitizePriorState(value: any) {
  if (!isPlainObject(value)) return null;
  const facts = isPlainObject(value.facts) ? value.facts : {};
  const urgency = isPlainObject(value.urgency) ? value.urgency : {};
  const informationStatus = isPlainObject(value.information_status)
    ? value.information_status
    : {};

  return {
    contract_version: clean(value.contract_version, 80),
    need_summary: clean(value.need_summary, 500),
    primary_intent: clean(value.primary_intent, 80),
    alternative_intents: cleanList(value.alternative_intents, 3, 80),
    care_path_candidates: cleanList(value.care_path_candidates, 4, 80),
    service_keys: cleanList(value.service_keys, 12, 120),
    provider_type_candidates: cleanList(value.provider_type_candidates, 8, 120),
    facts: {
      for_whom: clean(facts.for_whom, 40),
      age_group: clean(facts.age_group, 40),
      locality: sanitizeLocality(facts.locality),
      symptom_onset: clean(facts.symptom_onset, 240),
      symptom_duration: clean(facts.symptom_duration, 240),
      symptom_pattern: clean(facts.symptom_pattern, 400),
      desired_timing: clean(facts.desired_timing, 240),
      contact_lens_experience: clean(facts.contact_lens_experience, 40),
      prescription_status: clean(facts.prescription_status, 40),
      investigation_reference_text: clean(facts.investigation_reference_text, 500),
      repair_details: clean(facts.repair_details, 500),
      user_constraints: cleanList(facts.user_constraints, 8, 240),
    },
    urgency: {
      level: clean(urgency.level, 40),
      needs_clarification: urgency.needs_clarification === true,
      reason: clean(urgency.reason, 400),
    },
    understanding_confidence: clean(value.understanding_confidence, 40),
    information_status: {
      sufficient_for_search: informationStatus.sufficient_for_search === true,
      sufficient_for_specialist_message: informationStatus.sufficient_for_specialist_message === true,
      missing_critical_fields: cleanList(informationStatus.missing_critical_fields, 8, 80),
    },
    next_action: clean(value.next_action, 80),
  };
}

function hasLocality(locality: any) {
  return Boolean(locality?.siruta_code || locality?.city);
}

function redactContactDetails(value: unknown) {
  return clean(value, 1000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email eliminat]')
    .replace(/(?:\+?40[\s.-]?)?(?:0?2\d{2}|0?3\d{2}|0?7\d{2})(?:[\s.-]?\d){6,7}/g, '[telefon eliminat]')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function fallbackAssistantMessage(nextAction: string) {
  if (nextAction === 'ask_locality') {
    return 'In ce oras sau zona doresti sa cauti?';
  }
  if (nextAction === 'confirm_understanding') {
    return 'Am inteles nevoia descrisa. Este corect?';
  }
  if (nextAction === 'ask_clarifying_question') {
    return 'Poti sa imi spui putin mai clar ce ai nevoie sa rezolvi?';
  }
  return '';
}

function applyRuntimePolicy(envelope: any, runtimeContext: any) {
  if (!envelope?.interpretation) return envelope;

  const interpretation = {
    ...envelope.interpretation,
    facts: {
      ...envelope.interpretation.facts,
      locality: {
        ...envelope.interpretation.facts?.locality,
      },
    },
    urgency: {
      ...envelope.interpretation.urgency,
    },
    information_status: {
      ...envelope.interpretation.information_status,
      missing_critical_fields: [
        ...(envelope.interpretation.information_status?.missing_critical_fields || []),
      ],
    },
  };

  if (!hasLocality(interpretation.facts.locality) && hasLocality(runtimeContext.known_locality)) {
    interpretation.facts.locality = { ...runtimeContext.known_locality };
  }

  const urgencyLevel = interpretation.urgency?.level || 'none';
  const usableCarePath = (interpretation.care_path_candidates || []).some((path: string) => (
    !['unresolved', 'emergency_interruption'].includes(path)
  ));
  const hasServices = Array.isArray(interpretation.service_keys)
    && interpretation.service_keys.length > 0;
  const searchReady = urgencyLevel === 'none'
    && interpretation.primary_intent !== 'unknown'
    && usableCarePath
    && hasServices
    && hasLocality(interpretation.facts.locality);

  if (!searchReady) {
    interpretation.information_status.sufficient_for_search = false;
    if (interpretation.next_action === 'search_providers') {
      if (!hasLocality(interpretation.facts.locality) && hasServices && usableCarePath) {
        interpretation.next_action = 'ask_locality';
        if (!interpretation.information_status.missing_critical_fields.includes('locality')) {
          interpretation.information_status.missing_critical_fields.push('locality');
        }
      } else {
        interpretation.next_action = 'ask_clarifying_question';
      }
    }
  } else if (interpretation.next_action === 'search_providers') {
    interpretation.information_status.sufficient_for_search = true;
  }

  if (urgencyLevel === 'possible') {
    interpretation.next_action = 'ask_clarifying_question';
    interpretation.information_status.sufficient_for_search = false;
  }

  if (urgencyLevel === 'confirmed') {
    interpretation.next_action = 'show_emergency_guidance';
    interpretation.information_status.sufficient_for_search = false;
    interpretation.information_status.sufficient_for_specialist_message = false;
    interpretation.specialist_summary = null;
  }

  if (!runtimeContext.contact_share_approved && interpretation.specialist_summary) {
    interpretation.specialist_summary = redactContactDetails(interpretation.specialist_summary) || null;
  }

  if (!clean(interpretation.assistant_message, 700)) {
    interpretation.assistant_message = fallbackAssistantMessage(interpretation.next_action);
  }

  return {
    ...envelope,
    interpretation,
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

  const runtimeContext = runtimeContextFromPayload(payload);
  const prompt = buildPatientConversationAgentPrompt({
    conversation,
    priorState: sanitizePriorState(payload?.prior_state),
    runtimeContext,
  });

  try {
    const raw = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
      response_json_schema: getPatientConversationAgentResponseSchema(),
    });
    const completed = applyRuntimePolicy(buildPatientConversationShadowEnvelope({
      status: 'completed',
      raw,
      conversation,
    }), runtimeContext);
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
