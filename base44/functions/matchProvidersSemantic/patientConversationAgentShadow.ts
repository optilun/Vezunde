import {
  PATIENT_CONVERSATION_AGENT_VERSION,
} from '../../shared/patientConversationAgent.js';
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

function normalizeNonInvokedRuntimeIdentity(envelope: any, controller: any) {
  if (envelope?.reason !== 'user_message_required') return envelope;
  const operational = controller?.snapshot?.();
  if (operational?.model_calls_used !== 0) return envelope;

  return {
    ...envelope,
    runtime_metadata: {
      ...(envelope?.runtime_metadata || {}),
      model: null,
      prompt_version: null,
      model_invoked: false,
    },
  };
}

export async function runPatientConversationAgentShadow(base44: any, payload: any = {}) {
  const controller = createPatientConversationOperationalController(payload, {
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

  const envelope = await runPatientConversationAgentShadowCore(
    createOperationalBase44(base44, controller),
    payload,
  );
  return finalizePatientConversationOperationalEnvelope(
    normalizeNonInvokedRuntimeIdentity(envelope, controller),
    controller,
  );
}
