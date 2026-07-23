import {
  PATIENT_CONVERSATION_AGENT_VERSION,
} from '../../shared/patientConversationAgent.js';
import {
  PATIENT_CONVERSATION_MAX_CHARACTERS,
  PATIENT_CONVERSATION_MAX_TURNS,
} from '../../shared/patientConversationGuardrails.js';
import {
  createPatientConversationOperationalController,
  finalizePatientConversationOperationalEnvelope,
} from '../../shared/patientConversationOperationalPolicy.js';
import {
  runPatientConversationAgentShadow as runPatientConversationAgentShadowCore,
} from './patientConversationAgentShadowCore.ts';

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

function runtimePayloadFromRequest(payload: any = {}) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  if (normalizedEvaluationCaseId(source)) return source;

  const runtimePayload = { ...source };
  delete runtimePayload.prior_state;
  return runtimePayload;
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

function noModelRuntimeMetadata(durationMs = 0) {
  return {
    model: null,
    prompt_version: null,
    model_invoked: false,
    duration_ms: Math.max(0, Math.round(Number(durationMs) || 0)),
    input_limits: {
      max_turns: PATIENT_CONVERSATION_MAX_TURNS,
      max_characters: PATIENT_CONVERSATION_MAX_CHARACTERS,
    },
  };
}

function skippedWithoutUserMessage(payload: any = {}) {
  const evaluationCaseId = normalizedEvaluationCaseId(payload);
  return {
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'skipped',
    reason: 'user_message_required',
    interpretation: null,
    ...(evaluationCaseId ? {
      evaluation_case_id: evaluationCaseId,
      evaluation_attempt: normalizedEvaluationAttempt(payload),
    } : {}),
    runtime_metadata: noModelRuntimeMetadata(),
  };
}

function unavailableBeforeModel() {
  return {
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'unavailable',
    reason: 'conversation_runtime_unavailable',
    interpretation: null,
    runtime_metadata: noModelRuntimeMetadata(),
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

export async function runPatientConversationAgentShadow(base44: any, payload: any = {}) {
  const runtimePayload = runtimePayloadFromRequest(payload);
  const controller = createPatientConversationOperationalController(runtimePayload, {
    audience: 'admin_shadow',
  });

  if (!controller.allowed) {
    return finalizePatientConversationOperationalEnvelope({
      mode: 'shadow',
      contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
      status: 'skipped',
      reason: controller.reason,
      interpretation: null,
    }, controller);
  }

  if (!requestHasUserMessage(runtimePayload)) {
    return finalizePatientConversationOperationalEnvelope(
      skippedWithoutUserMessage(runtimePayload),
      controller,
    );
  }

  try {
    const envelope = await runPatientConversationAgentShadowCore(
      createOperationalBase44(base44, controller),
      runtimePayload,
    );
    return finalizePatientConversationOperationalEnvelope(
      normalizeRuntimeIdentity(envelope, controller),
      controller,
    );
  } catch (_error) {
    return finalizePatientConversationOperationalEnvelope(
      unavailableBeforeModel(),
      controller,
    );
  }
}
