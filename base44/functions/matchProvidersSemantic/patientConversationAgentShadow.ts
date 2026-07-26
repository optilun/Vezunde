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
  runPatientConversationAgentShadow as runPatientConversationAgentShadowRuntime,
} from './patientConversationAgentShadowRuntime.ts';

const PATIENT_CONVERSATION_MODEL_POLICY = 'base44_automatic';
const PATIENT_CONVERSATION_PROMPT_VERSION = 'viasee-patient-conversation-prompt-v1.3';

function isPlainObject(value: any) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function sanitizeLocality(value: any) {
  const locality = isPlainObject(value) ? value : {};
  return {
    siruta_code: String(locality?.siruta_code ?? '').trim().slice(0, 40),
    city: String(locality?.city ?? locality?.name ?? '').trim().slice(0, 120),
    county_code: String(locality?.county_code ?? '').trim().slice(0, 40),
    county: String(locality?.county ?? locality?.county_name ?? '').trim().slice(0, 120),
    area: String(locality?.area ?? '').trim().slice(0, 160),
  };
}

function controlledRuntimeContextFromPayload(payload: any = {}) {
  const explicitRuntimeContext = isPlainObject(payload?.runtime_context)
    ? payload.runtime_context
    : {};
  const explicitLocality = sanitizeLocality(explicitRuntimeContext?.known_locality);
  const fallbackLocality = sanitizeLocality({
    siruta_code: payload?.locality_siruta_code,
    city: payload?.locality_name || payload?.locality_city,
    county_code: payload?.county_code,
    county: payload?.county_name,
    area: payload?.locality_area,
  });
  const hasExplicitLocality = Boolean(explicitLocality.siruta_code || explicitLocality.city);

  return {
    locale: String(explicitRuntimeContext?.locale ?? '').trim().slice(0, 20) || 'ro-RO',
    known_locality: hasExplicitLocality ? explicitLocality : fallbackLocality,
    contact_share_approved: false,
  };
}

function noModelRuntimeMetadata(durationMs = 0) {
  return {
    model: null,
    model_policy: null,
    model_override: null,
    prompt_version: null,
    model_invoked: false,
    duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
    input_limits: {
      max_turns: PATIENT_CONVERSATION_MAX_TURNS,
      max_characters: PATIENT_CONVERSATION_MAX_CHARACTERS,
    },
  };
}

function createAutomaticModelBase44(base44: any) {
  const integrations = base44?.integrations || {};
  const core = integrations?.Core || {};
  const invokeModel = core?.InvokeLLM;
  const controlled = Object.create(base44 || null);

  Object.defineProperty(controlled, 'integrations', {
    value: {
      ...integrations,
      Core: {
        ...core,
        InvokeLLM: (args: any = {}) => {
          if (typeof invokeModel !== 'function') {
            const error: any = new Error('Base44 Core.InvokeLLM is unavailable.');
            error.code = 'PATIENT_CONVERSATION_MODEL_INVOKER_UNAVAILABLE';
            throw error;
          }
          const automaticArgs = { ...(isPlainObject(args) ? args : {}) };
          delete automaticArgs.model;
          return invokeModel.call(core, automaticArgs);
        },
      },
    },
    enumerable: true,
  });

  return controlled;
}

function hasGuidedAnswers(payload: any = {}) {
  return Array.isArray(payload?.answers) && payload.answers.length > 0;
}

function unresolvedInterpretation(runtimeContext: any) {
  return {
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    language: 'ro',
    need_summary: 'Cererea necesita o clarificare ghidata inainte de cautare.',
    primary_intent: 'unknown',
    alternative_intents: [],
    care_path_candidates: ['unresolved'],
    service_keys: [],
    provider_type_candidates: [],
    facts: {
      for_whom: 'unknown',
      age_group: 'unknown',
      locality: sanitizeLocality(runtimeContext?.known_locality),
      symptom_onset: '',
      symptom_duration: '',
      symptom_pattern: '',
      desired_timing: '',
      contact_lens_experience: 'unknown',
      prescription_status: 'unknown',
      investigation_reference_text: '',
      repair_details: '',
      user_constraints: [],
    },
    urgency: {
      level: 'none',
      needs_clarification: false,
      reason: '',
    },
    understanding_confidence: 'low',
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['need', 'service'],
    },
    next_action: 'ask_clarifying_question',
    assistant_message: '',
    specialist_summary: null,
    evidence_phrases: [],
  };
}

function canonicalizeInterpretation(interpretation: any) {
  return applyPatientConversationCanonicalBoundary(interpretation).interpretation;
}

function deterministicInterpretation({
  payload,
  reason,
}: {
  payload: any;
  reason: string;
}) {
  const conversation = conversationFromPayload(payload);
  const answers = sanitizeGuidedSafetyAnswers(payload?.answers);
  const runtimeContext = controlledRuntimeContextFromPayload(payload);
  const emergency = buildPatientConversationEmergencyInterpretation({
    contractVersion: PATIENT_CONVERSATION_AGENT_VERSION,
    conversation,
    answers,
    runtimeContext,
  });

  if (emergency) {
    return {
      interpretation: canonicalizeInterpretation(emergency.interpretation),
      diagnostics: {
        decision_policy: emergency.diagnostics,
        model_bypass: {
          applied: true,
          reason,
          model_calls_used: 0,
        },
      },
    };
  }

  const decision = applyPatientConversationDecisionPolicy({
    interpretation: unresolvedInterpretation(runtimeContext),
    conversation,
    answers,
    runtimeContext,
  });

  return {
    interpretation: canonicalizeInterpretation(decision.interpretation),
    diagnostics: {
      decision_policy: decision.diagnostics,
      model_bypass: {
        applied: true,
        reason,
        model_calls_used: 0,
      },
    },
  };
}

function attachGuidanceHandoff(envelope: any) {
  return {
    ...envelope,
    patient_guidance_handoff: buildPatientConversationGuidanceHandoff(envelope),
  };
}

function guidedAnswerEnvelope(payload: any = {}) {
  const startedAt = Date.now();
  const controller = createPatientConversationOperationalController(payload, {
    audience: 'admin_shadow',
  });

  if (!controller.allowed) {
    return attachGuidanceHandoff(finalizePatientConversationOperationalEnvelope({
      mode: 'shadow',
      contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
      status: 'skipped',
      reason: controller.reason,
      interpretation: null,
      ...evaluationCorrelation(payload),
      runtime_metadata: noModelRuntimeMetadata(Date.now() - startedAt),
    }, controller));
  }

  const deterministic = deterministicInterpretation({
    payload,
    reason: 'guided_answer_does_not_require_model',
  });
  return attachGuidanceHandoff(finalizePatientConversationOperationalEnvelope({
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'completed',
    reason: null,
    interpretation: deterministic.interpretation,
    diagnostics: deterministic.diagnostics,
    ...evaluationCorrelation(payload),
    runtime_metadata: noModelRuntimeMetadata(Date.now() - startedAt),
  }, controller));
}

function automaticRuntimeMetadata(envelope: any) {
  const metadata = isPlainObject(envelope?.runtime_metadata)
    ? envelope.runtime_metadata
    : {};
  const modelInvoked = metadata?.model_invoked === true;
  return {
    ...envelope,
    runtime_metadata: {
      ...metadata,
      model: null,
      model_policy: modelInvoked ? PATIENT_CONVERSATION_MODEL_POLICY : null,
      model_override: null,
      prompt_version: modelInvoked ? PATIENT_CONVERSATION_PROMPT_VERSION : null,
      model_invoked: modelInvoked,
    },
    diagnostics: {
      ...(envelope?.diagnostics || {}),
      model_selection: {
        policy: PATIENT_CONVERSATION_MODEL_POLICY,
        explicit_model_override: false,
        automatic_retry_enabled: false,
      },
    },
  };
}

function recoverTerminalFailure(envelope: any, payload: any = {}) {
  if (!['invalid', 'unavailable'].includes(String(envelope?.status || ''))) {
    return envelope;
  }

  const deterministic = deterministicInterpretation({
    payload,
    reason: 'terminal_model_failure',
  });
  return {
    ...envelope,
    status: 'completed',
    reason: null,
    interpretation: deterministic.interpretation,
    diagnostics: {
      ...(envelope?.diagnostics || {}),
      ...deterministic.diagnostics,
      terminal_fallback: {
        applied: true,
        original_status: String(envelope?.status || ''),
        original_reason: String(envelope?.reason || ''),
        search_blocked: true,
        retry_attempted: false,
      },
    },
  };
}

export async function runPatientConversationAgentShadow(base44: any, payload: any = {}) {
  if (hasGuidedAnswers(payload)) {
    return guidedAnswerEnvelope(payload);
  }

  const runtimeEnvelope = await runPatientConversationAgentShadowRuntime(
    createAutomaticModelBase44(base44),
    payload,
  );
  const automaticEnvelope = automaticRuntimeMetadata(runtimeEnvelope);
  return attachGuidanceHandoff(recoverTerminalFailure(automaticEnvelope, payload));
}
