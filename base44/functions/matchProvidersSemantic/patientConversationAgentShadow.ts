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
  return finalizePatientConversationOperationalEnvelope(envelope, controller);
}
