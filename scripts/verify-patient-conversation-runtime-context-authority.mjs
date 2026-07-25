import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildPatientConversationAgentPrompt,
} from '../shared/patientConversationAgent.js';
import {
  buildPatientConversationAgentPrompt as buildBase44PatientConversationAgentPrompt,
} from '../base44/shared/patientConversationAgent.js';
import {
  applyPatientConversationDecisionPolicy,
  buildPatientConversationEmergencyInterpretation,
} from '../shared/patientConversationDecisionPolicy.js';
import {
  applyPatientConversationDecisionPolicy as applyBase44PatientConversationDecisionPolicy,
  buildPatientConversationEmergencyInterpretation as buildBase44PatientConversationEmergencyInterpretation,
} from '../base44/shared/patientConversationDecisionPolicy.js';
import {
  applyPatientConversationDecisionPolicy as applyPatientConversationDecisionPolicyCore,
  buildPatientConversationEmergencyInterpretation as buildPatientConversationEmergencyInterpretationCore,
} from '../shared/patientConversationDecisionPolicyCore.js';
import {
  PATIENT_CONVERSATION_RUNTIME_CONTEXT_POLICY_VERSION,
  sanitizePatientConversationRuntimeContext,
} from '../shared/patientConversationRuntimeContextPolicy.js';
import {
  sanitizePatientConversationRuntimeContext as sanitizeBase44PatientConversationRuntimeContext,
} from '../base44/shared/patientConversationRuntimeContextPolicy.js';

function promptJson(prompt, key) {
  const prefix = `${key}=`;
  const line = String(prompt).split('\n').find((item) => item.startsWith(prefix));
  assert(line, `Prompt field ${key} is missing.`);
  return JSON.parse(line.slice(prefix.length));
}

function emptyLocality() {
  return {
    siruta_code: '',
    city: '',
    county_code: '',
    county: '',
    area: '',
  };
}

function routineInterpretation() {
  return {
    contract_version: 'viasee-patient-conversation-agent-v1',
    language: 'ro',
    need_summary: 'Control de vedere',
    primary_intent: 'control_vedere',
    alternative_intents: [],
    care_path_candidates: ['optometry'],
    service_keys: ['refraction'],
    provider_type_candidates: [],
    facts: {
      for_whom: 'adult',
      age_group: 'adult',
      locality: emptyLocality(),
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
    urgency: { level: 'none', needs_clarification: false, reason: '' },
    understanding_confidence: 'high',
    information_status: {
      sufficient_for_search: false,
      sufficient_for_specialist_message: false,
      missing_critical_fields: ['locality'],
    },
    next_action: 'ask_locality',
    assistant_message: '',
    specialist_summary: null,
    evidence_phrases: [],
  };
}

const sharedRuntimePolicySource = fs.readFileSync(
  'shared/patientConversationRuntimeContextPolicy.js',
  'utf8',
);
const base44RuntimePolicySource = fs.readFileSync(
  'base44/shared/patientConversationRuntimeContextPolicy.js',
  'utf8',
);
const sharedDecisionWrapperSource = fs.readFileSync(
  'shared/patientConversationDecisionPolicy.js',
  'utf8',
);
const base44DecisionWrapperSource = fs.readFileSync(
  'base44/shared/patientConversationDecisionPolicy.js',
  'utf8',
);
const semanticRuntimeSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
  'utf8',
);
const controlledRuntimeSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts',
  'utf8',
);

assert.equal(sharedRuntimePolicySource, base44RuntimePolicySource);
assert.equal(sharedDecisionWrapperSource, base44DecisionWrapperSource);
assert(sharedRuntimePolicySource.includes('PATIENT_CONVERSATION_RUNTIME_LOCALE = "ro-RO"'));
assert(sharedDecisionWrapperSource.includes('sanitizePatientConversationRuntimeContext'));
assert(semanticRuntimeSource.includes("from '../../shared/patientConversationDecisionPolicy.js';"));
assert(!semanticRuntimeSource.includes("from '../../shared/patientConversationDecisionPolicyCore.js';"));
assert(controlledRuntimeSource.includes("from '../../shared/patientConversationDecisionPolicy.js';"));
assert(!controlledRuntimeSource.includes("from '../../shared/patientConversationDecisionPolicyCore.js';"));
assert.equal(
  PATIENT_CONVERSATION_RUNTIME_CONTEXT_POLICY_VERSION,
  'viasee-patient-conversation-runtime-context-policy-v1',
);

const poisonedRuntimeContext = {
  locale: 'ro-RO<script>',
  known_locality: {
    siruta_code: '0',
    city: '+40 (722) 123 456',
    county_code: 'ZZ',
    county: 'model@example.com',
    area: 'https://evil.example/path',
  },
  contact_share_approved: true,
};
const controlledContext = sanitizePatientConversationRuntimeContext(poisonedRuntimeContext);
assert.deepEqual(
  sanitizeBase44PatientConversationRuntimeContext(poisonedRuntimeContext),
  controlledContext,
);
assert.deepEqual(controlledContext, {
  locale: 'ro-RO',
  known_locality: emptyLocality(),
  contact_share_approved: false,
});

const promptInput = {
  conversation: [{ role: 'user', content: 'Vreau un control de vedere.' }],
  runtimeContext: poisonedRuntimeContext,
};
const prompt = buildPatientConversationAgentPrompt(promptInput);
assert.equal(buildBase44PatientConversationAgentPrompt(promptInput), prompt);
assert.deepEqual(promptJson(prompt, 'RUNTIME_CONTEXT_JSON'), controlledContext);
for (const forbidden of [
  '+40 (722) 123 456',
  'model@example.com',
  'https://evil.example/path',
  'ro-RO<script>',
  '"contact_share_approved":true',
]) {
  assert(!prompt.includes(forbidden), `Runtime prompt leaked: ${forbidden}`);
}

const decisionInput = {
  interpretation: routineInterpretation(),
  conversation: [{ role: 'user', content: 'Vreau un control de vedere.' }],
  runtimeContext: poisonedRuntimeContext,
};
const controlledDecision = applyPatientConversationDecisionPolicy(decisionInput);
assert.deepEqual(
  applyBase44PatientConversationDecisionPolicy(decisionInput),
  controlledDecision,
);
assert.deepEqual(controlledDecision.interpretation.facts.locality, emptyLocality());
assert.equal(controlledDecision.interpretation.next_action, 'ask_locality');
assert.equal(controlledDecision.interpretation.information_status.sufficient_for_search, false);
assert.equal(controlledDecision.diagnostics.locality_source, 'missing');

const rawCoreDecision = applyPatientConversationDecisionPolicyCore(decisionInput);
assert.equal(rawCoreDecision.interpretation.facts.locality.city, '+40 (722) 123 456');
assert.equal(rawCoreDecision.interpretation.next_action, 'search_providers');
assert.equal(rawCoreDecision.interpretation.information_status.sufficient_for_search, true);

const validRuntimeContext = {
  locale: 'ro',
  known_locality: {
    siruta_code: '155243',
    city: 'Timisoara',
    county_code: 'tm',
    county: 'Timis',
    area: 'Centru',
  },
  contact_share_approved: true,
};
const validDecision = applyPatientConversationDecisionPolicy({
  ...decisionInput,
  runtimeContext: validRuntimeContext,
});
assert.deepEqual(validDecision.interpretation.facts.locality, {
  siruta_code: '155243',
  city: 'Timisoara',
  county_code: 'TM',
  county: 'Timis',
  area: 'Centru',
});
assert.equal(validDecision.interpretation.next_action, 'search_providers');
assert.equal(validDecision.interpretation.information_status.sufficient_for_search, true);
assert.equal(validDecision.diagnostics.locality_source, 'runtime_context');

const emergencyInput = {
  contractVersion: 'viasee-patient-conversation-agent-v1',
  conversation: [{ role: 'user', content: 'Mi-a disparut brusc vederea aproape complet.' }],
  runtimeContext: poisonedRuntimeContext,
};
const controlledEmergency = buildPatientConversationEmergencyInterpretation(emergencyInput);
assert.deepEqual(
  buildBase44PatientConversationEmergencyInterpretation(emergencyInput),
  controlledEmergency,
);
assert.deepEqual(controlledEmergency.interpretation.facts.locality, emptyLocality());
assert.equal(
  buildPatientConversationEmergencyInterpretationCore(emergencyInput)
    .interpretation.facts.locality.city,
  '+40 (722) 123 456',
);

console.log('Patient conversation runtime-context authority verified.');
