import {
  PATIENT_CONVERSATION_AGENT_VERSION,
} from '../../shared/patientConversationAgent.js';
import {
  applyPatientConversationDecisionPolicy,
  buildPatientConversationEmergencyInterpretation,
} from '../../shared/patientConversationDecisionPolicy.js';
import {
  buildPatientConversationGuidanceHandoff,
} from '../../shared/patientConversationGuidanceHandoff.js';
import {
  groundPatientConversationSymptomFacts,
} from '../../shared/patientConversationGrounding.js';
import {
  PATIENT_CONVERSATION_MAX_CHARACTERS,
  PATIENT_CONVERSATION_MAX_TURNS,
  sanitizePatientConversationTurns,
} from '../../shared/patientConversationGuardrails.js';
import {
  sanitizeGuidedSafetyAnswers,
} from '../../shared/patientEyeSafetyPolicy.js';
import {
  applyPatientConversationCanonicalBoundary,
} from '../../shared/patientConversationCanonicalBoundary.js';
import {
  createPatientConversationOperationalController,
  finalizePatientConversationOperationalEnvelope,
} from '../../shared/patientConversationOperationalPolicy.js';
import {
  runPatientConversationAgentShadow as runPatientConversationAgentShadowCore,
} from './patientConversationAgentShadowCore.ts';

const PATIENT_CONVERSATION_MODEL = 'gpt_5_4';
const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.2';

function createOperationalBase44(base44: any, controller: any) {
  const integrations = base44?.integrations || {};
  const core = integrations?.Core || {};
  const invokeModel = core?.InvokeLLM;
  const controlled = Object.create(base44 || null);

  Object.defineProperty(controlled, 'integrations', {
    value: {
      ...integrations,
      Core: {
        ...core,
        InvokeLLM: (args: any) => {
          if (typeof invokeModel !== 'function') {
            const error: any = new Error('Base44 Core.InvokeLLM is unavailable.');
            error.code = 'PATIENT_CONVERSATION_MODEL_INVOKER_UNAVAILABLE';
            throw error;
          }
          return controller.invoke(() => invokeModel.call(core, args));
        },
      },
    },
    enumerable: true,
  });

  return controlled;
}

function normalizedEvaluationCaseId(payload: any = {}) {
  const value = String(payload?.evaluation_case_id ?? '').trim();
  return /^[a-z0-9][a-z0-9._-]{0,119}$/i.test(value) ? value : '';
}

function normalizedEvaluationAttempt(payload: any = {}) {
  const value = String(payload?.evaluation_attempt ?? '').trim();
  return /^[1-5]$/.test(value) ? Number.parseInt(value, 10) : 1;
}

function evaluationCorrelation(payload: any = {}) {
  const evaluationCaseId = normalizedEvaluationCaseId(payload);
  return evaluationCaseId ? {
    evaluation_case_id: evaluationCaseId,
    evaluation_attempt: normalizedEvaluationAttempt(payload),
  } : {};
}

function runtimePayloadFromRequest(payload: any = {}) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  if (normalizedEvaluationCaseId(source)) return source;

  const runtimePayload = { ...source };
  delete runtimePayload.prior_state;
  return runtimePayload;
}

function conversationFromPayload(payload: any = {}) {
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

function controlledRuntimeContextFromPayload(payload: any = {}) {
  const explicitRuntimeContext = payload?.runtime_context
    && typeof payload.runtime_context === 'object'
    && !Array.isArray(payload.runtime_context)
    ? payload.runtime_context
    : {};
  const explicitLocality = explicitRuntimeContext?.known_locality
    && typeof explicitRuntimeContext.known_locality === 'object'
    && !Array.isArray(explicitRuntimeContext.known_locality)
    ? explicitRuntimeContext.known_locality
    : {};
  const fallbackLocality = {
    siruta_code: payload?.locality_siruta_code,
    city: payload?.locality_name || payload?.locality_city,
    county_code: payload?.county_code,
    county: payload?.county_name,
    area: payload?.locality_area,
  };
  const hasExplicitLocality = Boolean(
    String(explicitLocality?.siruta_code ?? '').trim()
    || String(explicitLocality?.city ?? explicitLocality?.name ?? '').trim()
  );

  return {
    locale: String(explicitRuntimeContext?.locale ?? '').trim().slice(0, 20) || 'ro-RO',
    known_locality: hasExplicitLocality ? explicitLocality : fallbackLocality,
    contact_share_approved: false,
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

function controlledSafetyPreflightEnvelope({
  payload,
  conversation,
  answers,
  runtimeContext,
  durationMs,
}: {
  payload: any;
  conversation: any[];
  answers: any[];
  runtimeContext: any;
  durationMs: number;
}) {
  if (answers.length === 0) return null;
  const decision = buildPatientConversationEmergencyInterpretation({
    contractVersion: PATIENT_CONVERSATION_AGENT_VERSION,
    conversation,
    answers,
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
    ...evaluationCorrelation(payload),
    runtime_metadata: noModelRuntimeMetadata(durationMs),
  });
}

function applyControlledSafetyDecision({
  envelope,
  conversation,
  answers,
  runtimeContext,
}: {
  envelope: any;
  conversation: any[];
  answers: any[];
  runtimeContext: any;
}) {
  if (
    answers.length === 0
    || envelope?.status !== 'completed'
    || !envelope?.interpretation
  ) {
    return envelope;
  }

  const decision = applyPatientConversationDecisionPolicy({
    interpretation: envelope.interpretation,
    conversation,
    answers,
    runtimeContext,
    stateDiagnostics: envelope?.diagnostics?.state_policy,
  });

  return applyCanonicalBoundary({
    ...envelope,
    interpretation: decision.interpretation,
    diagnostics: {
      ...(envelope.diagnostics || {}),
      decision_policy: decision.diagnostics,
    },
  });
}

function semanticPayloadWithoutControlledAnswers(payload: any = {}) {
  const semanticPayload = { ...payload };
  delete semanticPayload.answers;
  return semanticPayload;
}

function requestHasUserMessage(payload: any = {}) {
  const conversation = Array.isArray(payload?.conversation) ? payload.conversation : null;
  if (conversation && conversation.length > 0) {
    return conversation.some((turn: any) => (
      turn?.role === 'user' && String(turn?.content ?? '').trim()
    ));
  }

  return Boolean(String(
    payload?.search_text
    || payload?.query
    || payload?.free_text
    || payload?.search_query
    || '',
  ).trim());
}

function boundedDuration(durationMs = 0) {
  return Math.max(0, Math.round(Number(durationMs) || 0));
}

function noModelRuntimeMetadata(durationMs = 0) {
  return {
    model: null,
    prompt_version: null,
    model_invoked: false,
    duration_ms: boundedDuration(durationMs),
    input_limits: {
      max_turns: PATIENT_CONVERSATION_MAX_TURNS,
      max_characters: PATIENT_CONVERSATION_MAX_CHARACTERS,
    },
  };
}

function modelRuntimeMetadata(durationMs = 0) {
  return {
    model: PATIENT_CONVERSATION_MODEL,
    prompt_version: PATIENT_CONVERSATION_PROMPT_VERSION,
    model_invoked: true,
    duration_ms: boundedDuration(durationMs),
    input_limits: {
      max_turns: PATIENT_CONVERSATION_MAX_TURNS,
      max_characters: PATIENT_CONVERSATION_MAX_CHARACTERS,
    },
  };
}

function emitControlledPreflightSummary(envelope: any) {
  const decision = envelope?.diagnostics?.decision_policy;
  console.info('patient_conversation_agent_shadow_summary', JSON.stringify({
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    prompt_version: null,
    model: null,
    model_invoked: false,
    duration_ms: boundedDuration(envelope?.runtime_metadata?.duration_ms),
    status: envelope?.status || 'unknown',
    reason: envelope?.reason || null,
    evaluation_case_id_present: Boolean(envelope?.evaluation_case_id),
    evaluation_attempt: envelope?.evaluation_attempt || null,
    semantic_contract_version: null,
    model_operational_authority: false,
    semantic_correction_detected: false,
    semantic_clear_field_count: 0,
    state_delta_applied_field_count: 0,
    state_delta_preserved_replacement_count: 0,
    state_delta_rejected_field_count: 0,
    canonical_boundary_version:
      envelope?.diagnostics?.canonical_boundary?.boundary_version || null,
    provider_profile_type_count:
      envelope?.diagnostics?.canonical_boundary?.provider_profile_type_count || 0,
    location_provider_type_count:
      envelope?.diagnostics?.canonical_boundary?.location_provider_type_count || 0,
    prohibited_output_count: 0,
    schema_violation_count: 0,
    noncanonical_output_count: 0,
    state_transition: null,
    state_carried_field_count: 0,
    state_cleared_stale_field_count: 0,
    decision_source: decision?.decision_source || null,
    deterministic_safety_preflight:
      decision?.deterministic_safety_preflight === true,
    deterministic_safety_flag_count: Array.isArray(decision?.deterministic_safety_flags)
      ? decision.deterministic_safety_flags.length
      : 0,
    model_urgency_advisory: null,
    model_next_action_ignored: null,
    primary_intent: envelope?.interpretation?.primary_intent || 'unknown',
    care_path_count: Array.isArray(envelope?.interpretation?.care_path_candidates)
      ? envelope.interpretation.care_path_candidates.length
      : 0,
    service_count: Array.isArray(envelope?.interpretation?.service_keys)
      ? envelope.interpretation.service_keys.length
      : 0,
    urgency_level: envelope?.interpretation?.urgency?.level || 'unknown',
    next_action: envelope?.interpretation?.next_action || null,
    sufficient_for_search:
      envelope?.interpretation?.information_status?.sufficient_for_search === true,
  }));
}

function skippedWithoutUserMessage(payload: any = {}, durationMs = 0) {
  return {
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'skipped',
    reason: 'user_message_required',
    interpretation: null,
    ...evaluationCorrelation(payload),
    runtime_metadata: noModelRuntimeMetadata(durationMs),
  };
}

function unavailableRuntime({ payload, modelInvoked, durationMs }: {
  payload: any;
  modelInvoked: boolean;
  durationMs: number;
}) {
  return {
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'unavailable',
    reason: modelInvoked
      ? 'conversation_model_unavailable'
      : 'conversation_runtime_unavailable',
    interpretation: null,
    ...evaluationCorrelation(payload),
    runtime_metadata: modelInvoked
      ? modelRuntimeMetadata(durationMs)
      : noModelRuntimeMetadata(durationMs),
  };
}

function normalizeRuntimeIdentity(envelope: any, controller: any) {
  const snapshot = controller?.snapshot?.();
  if (snapshot?.model_calls_used !== 0) return envelope;
  return {
    ...envelope,
    runtime_metadata: {
      ...noModelRuntimeMetadata(envelope?.runtime_metadata?.duration_ms),
      ...(envelope?.runtime_metadata || {}),
      model: null,
      prompt_version: null,
      model_invoked: false,
    },
  };
}

function applySymptomGrounding(envelope: any, payload: any = {}) {
  if (envelope?.status !== 'completed' || !envelope?.interpretation) return envelope;

  const grounding = groundPatientConversationSymptomFacts({
    rawFacts: envelope.interpretation.facts,
    evidencePhrases: envelope.interpretation.evidence_phrases,
    conversation: conversationFromPayload(payload),
  });
  const diagnostics = {
    ...(envelope.diagnostics || {}),
    grounding: grounding.diagnostics,
  };

  if (grounding.diagnostics.rejected_fact_fields.length > 0) {
    return {
      ...envelope,
      status: 'invalid',
      reason: 'ungrounded_symptom_facts',
      interpretation: null,
      diagnostics,
    };
  }

  return {
    ...envelope,
    interpretation: {
      ...envelope.interpretation,
      facts: {
        ...(envelope.interpretation.facts || {}),
        ...grounding.grounded_facts,
      },
      fact_evidence: grounding.fact_evidence,
    },
    diagnostics,
  };
}

function attachGuidanceHandoff(envelope: any) {
  return {
    ...envelope,
    patient_guidance_handoff: buildPatientConversationGuidanceHandoff(envelope),
  };
}

function finalizeWithGuidanceHandoff(envelope: any, controller: any) {
  return attachGuidanceHandoff(
    finalizePatientConversationOperationalEnvelope(envelope, controller),
  );
}

export async function runPatientConversationAgentShadow(base44: any, payload: any = {}) {
  const startedAt = Date.now();
  const runtimePayload = runtimePayloadFromRequest(payload);
  const controller = createPatientConversationOperationalController(runtimePayload, {
    audience: 'admin_shadow',
  });

  if (!controller.allowed) {
    return finalizeWithGuidanceHandoff({
      mode: 'shadow',
      contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
      status: 'skipped',
      reason: controller.reason,
      interpretation: null,
      ...evaluationCorrelation(runtimePayload),
    }, controller);
  }

  if (!requestHasUserMessage(runtimePayload)) {
    return finalizeWithGuidanceHandoff(
      skippedWithoutUserMessage(runtimePayload, Date.now() - startedAt),
      controller,
    );
  }

  try {
    const conversation = conversationFromPayload(runtimePayload);
    const controlledAnswers = sanitizeGuidedSafetyAnswers(runtimePayload?.answers);
    const controlledRuntimeContext = controlledRuntimeContextFromPayload(runtimePayload);
    const controlledPreflight = controlledSafetyPreflightEnvelope({
      payload: runtimePayload,
      conversation,
      answers: controlledAnswers,
      runtimeContext: controlledRuntimeContext,
      durationMs: Date.now() - startedAt,
    });
    const coreEnvelope = controlledPreflight || await runPatientConversationAgentShadowCore(
      createOperationalBase44(base44, controller),
      semanticPayloadWithoutControlledAnswers(runtimePayload),
    );
    const envelope = controlledPreflight || applyControlledSafetyDecision({
      envelope: coreEnvelope,
      conversation,
      answers: controlledAnswers,
      runtimeContext: controlledRuntimeContext,
    });
    if (controlledPreflight) emitControlledPreflightSummary(envelope);
    const groundedEnvelope = applySymptomGrounding(
      normalizeRuntimeIdentity(envelope, controller),
      runtimePayload,
    );
    return finalizeWithGuidanceHandoff(
      groundedEnvelope,
      controller,
    );
  } catch (_error) {
    const snapshot = controller.snapshot();
    return finalizeWithGuidanceHandoff(
      unavailableRuntime({
        payload: runtimePayload,
        modelInvoked: snapshot.model_calls_used > 0,
        durationMs: Date.now() - startedAt,
      }),
      controller,
    );
  }
}
