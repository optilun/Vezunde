import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION,
  getPatientConversationAgentResponseSchema,
} from '../shared/patientConversationAgent.js';
import {
  detectProhibitedPatientConversationOutput,
  validatePatientConversationModelResponse,
} from '../shared/patientConversationGuardrails.js';

const sharedGuardrailSource = fs.readFileSync(
  new URL('../shared/patientConversationGuardrails.js', import.meta.url),
  'utf8',
);
const base44GuardrailSource = fs.readFileSync(
  new URL('../base44/shared/patientConversationGuardrails.js', import.meta.url),
  'utf8',
);
const runnerSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts', import.meta.url),
  'utf8',
);

function validResponse() {
  return {
    contract_version: PATIENT_CONVERSATION_SEMANTIC_CONTRACT_VERSION,
    language: 'ro',
    need_summary: 'Control de vedere in Timisoara.',
    primary_intent: 'control_vedere',
    alternative_intents: [],
    service_keys: ['optometry_consultation'],
    facts: {
      for_whom: 'adult',
      age_group: 'adult',
      locality: {
        siruta_code: '',
        city: 'Timisoara',
        county_code: 'TM',
        county: 'Timis',
        area: '',
      },
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
    understanding_confidence: 'high',
    ambiguity_fields: [],
    possible_safety_flags: [],
    state_delta: {
      correction_detected: false,
      clear_fields: [],
    },
    evidence_phrases: ['control de vedere in Timisoara'],
  };
}

const schema = getPatientConversationAgentResponseSchema();
assert.deepEqual(validatePatientConversationModelResponse(validResponse(), schema), []);
assert.equal(sharedGuardrailSource, base44GuardrailSource);

for (const forbiddenOperationalField of [
  'care_path_candidates',
  'provider_type_candidates',
  'urgency',
  'information_status',
  'next_action',
  'assistant_message',
  'specialist_summary',
]) {
  const unexpected = {
    ...validResponse(),
    [forbiddenOperationalField]: forbiddenOperationalField === 'provider_type_candidates'
      ? ['independent_optometrist']
      : 'model_decision',
  };
  assert(
    validatePatientConversationModelResponse(unexpected, schema)
      .includes(`schema_unexpected:$.${forbiddenOperationalField}`),
    `${forbiddenOperationalField} must be rejected from the model contract`,
  );
}

const missingField = validResponse();
delete missingField.state_delta;
assert(validatePatientConversationModelResponse(missingField, schema)
  .includes('schema_missing:$.state_delta'));

const unexpectedProviderField = {
  ...validResponse(),
  provider_id: 'provider-1',
};
assert(validatePatientConversationModelResponse(unexpectedProviderField, schema)
  .includes('schema_unexpected:$.provider_id'));
assert(detectProhibitedPatientConversationOutput(unexpectedProviderField)
  .includes('forbidden_field:provider_id'));

const nestedTreatmentDirective = validResponse();
nestedTreatmentDirective.facts.user_constraints = ['Ia picaturi antibiotice.'];
assert(detectProhibitedPatientConversationOutput(nestedTreatmentDirective)
  .includes('treatment_directive'));

const nestedDiagnosisClaim = validResponse();
nestedDiagnosisClaim.facts.symptom_pattern = 'Ai glaucom.';
assert(detectProhibitedPatientConversationOutput(nestedDiagnosisClaim)
  .includes('diagnosis_claim'));

const splitDiagnosisFragments = validResponse();
splitDiagnosisFragments.facts.symptom_onset = 'ai';
splitDiagnosisFragments.facts.symptom_pattern = 'glaucom';
assert.equal(
  detectProhibitedPatientConversationOutput(splitDiagnosisFragments)
    .includes('diagnosis_claim'),
  false,
  'Strings from separate semantic fields must not be concatenated into a diagnosis claim.',
);

const nestedProviderRecommendation = validResponse();
nestedProviderRecommendation.facts.repair_details = 'Recomandam clinica pentru aceasta problema.';
assert(detectProhibitedPatientConversationOutput(nestedProviderRecommendation)
  .includes('ranking_or_provider_recommendation_claim'));

const verbatimEvidenceOnly = validResponse();
verbatimEvidenceOnly.evidence_phrases = ['ia picaturi antibiotice'];
assert.equal(
  detectProhibitedPatientConversationOutput(verbatimEvidenceOnly)
    .includes('treatment_directive'),
  false,
  'Verbatim evidence phrases are grounded separately and must not be treated as generated directives.',
);

const invalidIntent = {
  ...validResponse(),
  primary_intent: 'invented_intent',
};
assert(validatePatientConversationModelResponse(invalidIntent, schema)
  .includes('schema_enum:$.primary_intent'));

const invalidService = {
  ...validResponse(),
  service_keys: ['invented_service'],
};
assert(validatePatientConversationModelResponse(invalidService, schema)
  .includes('schema_enum:$.service_keys[0]'));

const tooManyAlternatives = {
  ...validResponse(),
  alternative_intents: [
    'control_vedere',
    'ochelari_lentile',
    'lentile_contact',
    'reparatii_ochelari',
  ],
};
assert(validatePatientConversationModelResponse(tooManyAlternatives, schema)
  .includes('schema_max_items:$.alternative_intents'));

const invalidSafetyFlag = {
  ...validResponse(),
  possible_safety_flags: ['model_says_safe'],
};
assert(validatePatientConversationModelResponse(invalidSafetyFlag, schema)
  .includes('schema_enum:$.possible_safety_flags[0]'));

const invalidClearField = {
  ...validResponse(),
  state_delta: {
    correction_detected: true,
    clear_fields: ['provider_ranking'],
  },
};
assert(validatePatientConversationModelResponse(invalidClearField, schema)
  .includes('schema_enum:$.state_delta.clear_fields[0]'));

const invalidCorrectionBoolean = {
  ...validResponse(),
  state_delta: {
    correction_detected: 'yes',
    clear_fields: [],
  },
};
assert(validatePatientConversationModelResponse(invalidCorrectionBoolean, schema)
  .includes('schema_type_boolean:$.state_delta.correction_detected'));

assert(runnerSource.includes('validatePatientConversationModelResponse(raw, responseSchema)'));
assert(runnerSource.includes("invalidModelOutputEnvelope('invalid_model_output_shape'"));
assert(runnerSource.includes("invalidModelOutputEnvelope('noncanonical_model_output'"));
assert(runnerSource.includes('noncanonicalOutputCount > 0'));

const prohibitedIndex = runnerSource.indexOf('detectProhibitedPatientConversationOutput(raw)');
const schemaIndex = runnerSource.indexOf('validatePatientConversationModelResponse(raw, responseSchema)');
const buildIndex = runnerSource.indexOf('const builtEnvelope = buildPatientConversationShadowEnvelope({');
assert(prohibitedIndex >= 0 && schemaIndex > prohibitedIndex);
assert(buildIndex > schemaIndex);

console.log('Patient conversation semantic model response contract verified fail closed.');
