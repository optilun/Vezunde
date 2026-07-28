import {
  PATIENT_CONVERSATION_AGENT_VERSION,
  buildPatientConversationAgentPrompt,
  buildPatientConversationShadowEnvelope,
  getPatientConversationAgentResponseSchema,
} from '../../shared/patientConversationAgent.js';
import {
  PATIENT_CONVERSATION_MAX_CHARACTERS,
  PATIENT_CONVERSATION_MAX_TURNS,
  detectProhibitedPatientConversationOutput,
  redactPatientConversationText,
  sanitizePatientConversationTurns,
  validatePatientConversationModelResponse,
} from '../../shared/patientConversationGuardrails.js';
import {
  applyPatientConversationDecisionPolicy,
  buildPatientConversationEmergencyInterpretation,
} from '../../shared/patientConversationDecisionPolicy.js';
import { applyPatientConversationCanonicalBoundary } from '../../shared/patientConversationCanonicalBoundary.js';
import { reconcilePatientConversationState } from '../../shared/patientConversationStatePolicy.js';
import { reducePatientConversationSemanticStateDelta } from '../../shared/patientConversationStateDeltaReducer.js';
import {
  PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_PROFILE,
  parsePatientConversationAutomaticOutput,
} from './patientConversationAutomaticOutputParser.js';

const PATIENT_CONVERSATION_SHADOW_EVENT = 'patient_conversation_agent_shadow_summary';
const PATIENT_CONVERSATION_MODEL_POLICY = 'base44_automatic';
const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3';

function clean(value: unknown, maxLength = 1200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanList(value: unknown, limit = 12, maxLength = 160) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => redactPatientConversationText(item, maxLength))
      .filter(Boolean),
  )].slice(0, limit);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function evaluationCaseIdFromPayload(payload: any) {
  const value = clean(payload?.evaluation_case_id, 120);
  return /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(value) ? value : '';
}

function evaluationAttemptFromPayload(payload: any) {
  const value = String(payload?.evaluation_attempt ?? '').trim();
  return /^[1-5]$/.test(value) ? Number.parseInt(value, 10) : 1;
}

function attachEvaluationCorrelation(envelope: any, evaluationCaseId: string, evaluationAttempt: number) {
  return evaluationCaseId ? {
    ...envelope,
    evaluation_case_id: evaluationCaseId,
    evaluation_attempt: evaluationAttempt,
  } : envelope;
}

function attachRuntimeMetadata(
  envelope: any,
  durationMs: number,
  { modelInvoked = true } = {},
) {
  return {
    ...envelope,
    runtime_metadata: {
      model: null,
      model_policy: modelInvoked ? PATIENT_CONVERSATION_MODEL_POLICY : null,
      model_override: null,
      prompt_version: modelInvoked ? PATIENT_CONVERSATION_PROMPT_VERSION : null,
      model_invoked: modelInvoked,
      duration_ms: Math.max(0, Math.round(durationMs)),
      input_limits: {
        max_turns: PATIENT_CONVERSATION_MAX_TURNS,
        max_characters: PATIENT_CONVERSATION_MAX_CHARACTERS,
      },
    },
  };
}

function conversationFromPayload(payload: any) {
  const source = Array.isArray(payload?.conversation)
    ? payload.conversation
    : null;
  const fallbackText = payload?.search_text
    || payload?.query
    || payload?.free_text
    || payload?.search_query
    || '';
  return sanitizePatientConversationTurns(
    Array.isArray(source) && source.length > 0 ? source : null,
    fallbackText,
  );
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
    contact_share_approved: false,
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
    need_summary: redactPatientConversationText(value.need_summary, 500),
    primary_intent: clean(value.primary_intent, 80),
    alternative_intents: cleanList(value.alternative_intents, 3, 80),
    care_path_candidates: cleanList(value.care_path_candidates, 4, 80),
    service_keys: cleanList(value.service_keys, 12, 120),
    provider_type_candidates: cleanList(value.provider_type_candidates, 8, 120),
    facts: {
      for_whom: clean(facts.for_whom, 40),
      age_group: clean(facts.age_group, 40),
      locality: sanitizeLocality(facts.locality),
      symptom_onset: redactPatientConversationText(facts.symptom_onset, 240),
      symptom_duration: redactPatientConversationText(facts.symptom_duration, 240),
      symptom_pattern: redactPatientConversationText(facts.symptom_pattern, 400),
      desired_timing: redactPatientConversationText(facts.desired_timing, 240),
      contact_lens_experience: clean(facts.contact_lens_experience, 40),
      prescription_status: clean(facts.prescription_status, 40),
      investigation_reference_text: redactPatientConversationText(facts.investigation_reference_text, 500),
      repair_details: redactPatientConversationText(facts.repair_details, 500),
      user_constraints: cleanList(facts.user_constraints, 8, 240),
    },
    urgency: {
      level: clean(urgency.level, 40),
      needs_clarification: urgency.needs_clarification === true,
      reason: redactPatientConversationText(urgency.reason, 400),
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

function invalidModelOutputEnvelope(reason: string, diagnostics: Record<string, any>) {
  return {
    ...buildPatientConversationShadowEnvelope({
      status: 'unavailable',
      reason,
    }),
    status: 'invalid',
    reason,
    diagnostics: {
      invalid_response_shape: reason === 'invalid_model_output_shape',
      ...diagnostics,
    },
  };
}

function applyConversationStatePolicy(envelope: any, priorState: any, conversation: any[]) {
  if (!envelope?.interpretation) return envelope;
  const reconciled = reconcilePatientConversationState({
    interpretation: envelope.interpretation,
    priorState,
    conversation,
  });
  return {
    ...envelope,
    interpretation: reconciled.interpretation,
    diagnostics: {
      ...(envelope.diagnostics || {}),
      state_policy: reconciled.diagnostics,
    },
  };
}

function applySemanticStateDeltaReducer(
  envelope: any,
  priorState: any,
  conversation: any[],
) {
  if (!envelope?.interpretation) return envelope;
  const reduced = reducePatientConversationSemanticStateDelta({
    interpretation: envelope.interpretation,
    priorState,
    conversation,
    semanticStateDelta: envelope?.diagnostics?.semantic_state_delta,
  });
  return {
    ...envelope,
    interpretation: reduced.interpretation,
    diagnostics: {
      ...(envelope.diagnostics || {}),
      state_delta_reducer: reduced.diagnostics,
    },
  };
}

function applyDeterministicDecisionPolicy(
  envelope: any,
  conversation: any[],
  runtimeContext: any,
) {
  if (!envelope?.interpretation) return envelope;
  const decision = applyPatientConversationDecisionPolicy({
    interpretation: envelope.interpretation,
    conversation,
    runtimeContext,
    stateDiagnostics: envelope?.diagnostics?.state_policy,
  });
  return {
    ...envelope,
    interpretation: decision.interpretation,
    diagnostics: {
      ...(envelope.diagnostics || {}),
      decision_policy: decision.diagnostics,
    },
  };
}

function applyCanonicalBoundary(envelope: any) {
  if (!envelope?.interpretation) return envelope;
  const canonical = applyPatientConversationCanonicalBoundary(envelope.interpretation);
  return {
    ...envelope,
    interpretation: canonical.interpretation,
    diagnostics: {
      ...(envelope.diagnostics || {}),
      canonical_boundary: canonical.diagnostics,
    },
  };
}

function deterministicSafetyPreflight(conversation: any[], runtimeContext: any) {
  const decision = buildPatientConversationEmergencyInterpretation({
    contractVersion: PATIENT_CONVERSATION_AGENT_VERSION,
    conversation,
    runtimeContext,
  });
  if (!decision) return null;
  return applyCanonicalBoundary({
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'completed',
    reason: null,
    interpretation: decision.interpretation,
    diagnostics: {
      decision_policy: decision.diagnostics,
    },
  });
}

function emitShadowSummary(envelope: any) {
  console.info(PATIENT_CONVERSATION_SHADOW_EVENT, JSON.stringify({
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    prompt_version: envelope?.runtime_metadata?.prompt_version || null,
    model: envelope?.runtime_metadata?.model || null,
    model_policy: envelope?.runtime_metadata?.model_policy || null,
    model_invoked: envelope?.runtime_metadata?.model_invoked === true,
    duration_ms: envelope?.runtime_metadata?.duration_ms || 0,
    status: envelope?.status || 'unknown',
    reason: envelope?.reason || null,
    evaluation_case_id_present: Boolean(envelope?.evaluation_case_id),
    evaluation_attempt: envelope?.evaluation_attempt || null,
    semantic_contract_version: envelope?.diagnostics?.semantic_contract_version || null,
    model_operational_authority:
      envelope?.diagnostics?.model_operational_authority === true,
    semantic_correction_detected:
      envelope?.diagnostics?.semantic_state_delta?.correction_detected === true,
    semantic_clear_field_count: Array.isArray(
      envelope?.diagnostics?.semantic_state_delta?.clear_fields,
    )
      ? envelope.diagnostics.semantic_state_delta.clear_fields.length
      : 0,
    state_delta_applied_field_count: Array.isArray(
      envelope?.diagnostics?.state_delta_reducer?.applied_fields,
    )
      ? envelope.diagnostics.state_delta_reducer.applied_fields.length
      : 0,
    state_delta_preserved_replacement_count: Array.isArray(
      envelope?.diagnostics?.state_delta_reducer?.replacement_preserved_fields,
    )
      ? envelope.diagnostics.state_delta_reducer.replacement_preserved_fields.length
      : 0,
    state_delta_rejected_field_count: Array.isArray(
      envelope?.diagnostics?.state_delta_reducer?.rejected_fields,
    )
      ? envelope.diagnostics.state_delta_reducer.rejected_fields.length
      : 0,
    canonical_boundary_version:
      envelope?.diagnostics?.canonical_boundary?.boundary_version || null,
    provider_profile_type_count:
      envelope?.diagnostics?.canonical_boundary?.provider_profile_type_count || 0,
    location_provider_type_count:
      envelope?.diagnostics?.canonical_boundary?.location_provider_type_count || 0,
    prohibited_output_count: Array.isArray(envelope?.diagnostics?.prohibited_output_violations)
      ? envelope.diagnostics.prohibited_output_violations.length
      : 0,
    schema_violation_count: Array.isArray(envelope?.diagnostics?.schema_violations)
      ? envelope.diagnostics.schema_violations.length
      : 0,
    noncanonical_output_count: Number(envelope?.diagnostics?.noncanonical_output_count) || 0,

  }));
}

export async function runPatientConversationAgentShadow(base44: any, payload: any = {}) {
  const startedAt = Date.now();
  const evaluationCaseId = evaluationCaseIdFromPayload(payload);
  const evaluationAttempt = evaluationAttemptFromPayload(payload);
  const conversation = conversationFromPayload(payload);
  const hasUserMessage = conversation.some((turn: any) => (
    turn?.role === 'user' && clean(turn?.content)
  ));

  if (!hasUserMessage) {
    const skipped = attachRuntimeMetadata(attachEvaluationCorrelation(buildPatientConversationShadowEnvelope({
      status: 'skipped',
      reason: 'user_message_required',
    }), evaluationCaseId, evaluationAttempt), Date.now() - startedAt);
    emitShadowSummary(skipped);
    return skipped;
  }

  const runtimeContext = runtimeContextFromPayload(payload);
  const priorState = sanitizePriorState(payload?.prior_state);
  const preflightDecision = deterministicSafetyPreflight(conversation, runtimeContext);
  if (preflightDecision) {
    const completed = attachRuntimeMetadata(attachEvaluationCorrelation(
      preflightDecision,
      evaluationCaseId,
      evaluationAttempt,
    ), Date.now() - startedAt, { modelInvoked: false });
    emitShadowSummary(completed);
    return completed;
  }

  const prompt = buildPatientConversationAgentPrompt({
    conversation,
    priorState,
    runtimeContext,
  });
  const responseSchema = getPatientConversationAgentResponseSchema();

  try {
    const modelOutput = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false,
    });
    const parsedAutomaticOutput = parsePatientConversationAutomaticOutput(modelOutput);
    if (!parsedAutomaticOutput.ok) {
      const invalid = attachRuntimeMetadata(attachEvaluationCorrelation(
        invalidModelOutputEnvelope('invalid_model_output_shape', {
          schema_violations: [
            `automatic_output_${parsedAutomaticOutput.reason}`,
          ],
          automatic_output_parser: {
            accepted: false,
            reason: parsedAutomaticOutput.reason,
            output_profile: PATIENT_CONVERSATION_AUTOMATIC_OUTPUT_PROFILE,
          },
        }),
        evaluationCaseId,
        evaluationAttempt,
      ), Date.now() - startedAt);
      emitShadowSummary(invalid);
      return invalid;
    }

    const raw = parsedAutomaticOutput.value;
    const prohibitedOutputViolations = detectProhibitedPatientConversationOutput(raw);
    if (prohibitedOutputViolations.length > 0) {
      const invalid = attachRuntimeMetadata(attachEvaluationCorrelation(
        invalidModelOutputEnvelope('prohibited_model_output', {
          prohibited_output_violations: prohibitedOutputViolations,
        }),
        evaluationCaseId,
        evaluationAttempt,
      ), Date.now() - startedAt);
      emitShadowSummary(invalid);
      return invalid;
    }

    const schemaViolations = validatePatientConversationModelResponse(raw, responseSchema);
    if (schemaViolations.length > 0) {
      const invalid = attachRuntimeMetadata(attachEvaluationCorrelation(
        invalidModelOutputEnvelope('invalid_model_output_shape', {
          schema_violations: schemaViolations,
        }),
        evaluationCaseId,
        evaluationAttempt,
      ), Date.now() - startedAt);
      emitShadowSummary(invalid);
      return invalid;
    }

    const builtEnvelope = buildPatientConversationShadowEnvelope({
      status: 'completed',
      raw,
      conversation,
    });
    const rejectedServiceCount = Number(
      builtEnvelope?.diagnostics?.rejected_service_count || 0,
    );
    const rejectedEvidencePhraseCount = Number(
      builtEnvelope?.diagnostics?.rejected_evidence_phrase_count || 0,
    );
    const noncanonicalOutputCount = rejectedServiceCount + rejectedEvidencePhraseCount;
    if (noncanonicalOutputCount > 0) {
      const invalid = attachRuntimeMetadata(attachEvaluationCorrelation(
        invalidModelOutputEnvelope('noncanonical_model_output', {
          noncanonical_output_count: noncanonicalOutputCount,
          rejected_service_count: rejectedServiceCount,
          rejected_evidence_phrase_count: rejectedEvidencePhraseCount,
        }),
        evaluationCaseId,
        evaluationAttempt,
      ), Date.now() - startedAt);
      emitShadowSummary(invalid);
      return invalid;
    }

    const stateEnvelope = applyConversationStatePolicy(builtEnvelope, priorState, conversation);
    const deltaEnvelope = applySemanticStateDeltaReducer(
      stateEnvelope,
      priorState,
      conversation,
    );
    const deterministicEnvelope = applyDeterministicDecisionPolicy(
      deltaEnvelope,
      conversation,
      runtimeContext,
    );
    const canonicalEnvelope = applyCanonicalBoundary(deterministicEnvelope);
    const completed = attachRuntimeMetadata(attachEvaluationCorrelation(
      canonicalEnvelope,
      evaluationCaseId,
      evaluationAttempt,
    ), Date.now() - startedAt);
    emitShadowSummary(completed);
    return completed;
  } catch (_error) {
    const unavailable = attachRuntimeMetadata(attachEvaluationCorrelation(buildPatientConversationShadowEnvelope({
      status: 'unavailable',
      conversation,
      reason: 'conversation_model_unavailable',
    }), evaluationCaseId, evaluationAttempt), Date.now() - startedAt);
    emitShadowSummary(unavailable);
    return unavailable;
  }
}