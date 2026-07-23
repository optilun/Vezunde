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
        InvokeLLM: (args: any) => controller.invoke(() => {
          if (typeof invokeModel !== 'function') {
            const error: any = new Error('Base44 Core.InvokeLLM is unavailable.');
            error.code = 'PATIENT_CONVERSATION_MODEL_INVOKER_UNAVAILABLE';
            throw error;
          }
          return invokeModel.call(core, args);
        }),
      },
    },
    enumerable: true,
  });

  return controlled;
}

function runtimePayloadFromRequest(payload: any = {}) {
  const source = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload
    : {};
  const evaluationCaseId = String(source.evaluation_case_id ?? '').trim();
  if (/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(evaluationCaseId)) return source;

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

function skippedWithoutUserMessage() {
  return {
    mode: 'shadow',
    contract_version: PATIENT_CONVERSATION_AGENT_VERSION,
    status: 'skipped',
    reason: 'user_message_required',
    interpretation: null,
    runtime_metadata: {
      model: null,
      prompt_version: null,
      model_invoked: false,
      duration_ms: 0,
      input_limits: {
        max_turns: PATIENT_CONVERSATION_MAX_TURNS,
        max_characters: PATIENT_CONVERSATION_MAX_CHARACTERS,
      },
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
      skippedWithoutUserMessage(),
      controller,
    );
  }

  const envelope = await runPatientConversationAgentShadowCore(
    createOperationalBase44(base44, controller),
    runtimePayload,
  );
  return finalizePatientConversationOperationalEnvelope(envelope, controller);
}
