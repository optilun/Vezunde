import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
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
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadow.ts', import.meta.url),
  'utf8',
);

function validResponse() {
  return {
    contract_version: 'viasee-patient-conversation-agent-v1',
    language: 'ro',
    need_summary: 'Control de vedere in Timisoara.',
    primary_intent: 'control_vedere',
    alternative_intents: [],
    care_path_candidates: ['optometry'],
    service_keys: ['optometry_consultation'],
    provider_type_candidates: ['independent_optometrist'],
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
    urgency: {
      level: 'none',
      needs_clarification: false,
      reason: '',
    },
    understanding_confidence: 'high',
    information_status: {
      sufficient_for_search: true,
      sufficient_for_specialist_message: false,
      missing_critical_fields: [],
    },
    next_action: 'search_providers',
    assistant_message: 'Am inteles. Pot cauta servicii in Timisoara.',
    specialist_summary: null,
    evidence_phrases: ['control de vedere in Timisoara'],
  };
}

const schema = getPatientConversationAgentResponseSchema();
assert.deepEqual(validatePatientConversationModelResponse(validResponse(), schema), []);
assert.equal(sharedGuardrailSource, base44GuardrailSource);

const missingField = validResponse();
delete missingField.assistant_message;
assert(validatePatientConversationModelResponse(missingField, schema)
  .includes('schema_missing:$.assistant_message'));

const unexpectedField = {
  ...validResponse(),
  provider_id: 'provider-1',
};
assert(validatePatientConversationModelResponse(unexpectedField, schema)
  .includes('schema_unexpected:$.provider_id'));
assert(detectProhibitedPatientConversationOutput(unexpectedField)
  .includes('forbidden_field:provider_id'));

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

const invalidSpecialistSummary = {
  ...validResponse(),
  specialist_summary: 42,
};
assert(validatePatientConversationModelResponse(invalidSpecialistSummary, schema)
  .includes('schema_any_of:$.specialist_summary'));

const invalidNestedBoolean = validResponse();
invalidNestedBoolean.information_status.sufficient_for_search = 'yes';
assert(validatePatientConversationModelResponse(invalidNestedBoolean, schema)
  .includes('schema_type_boolean:$.information_status.sufficient_for_search'));

assert(runnerSource.includes('validatePatientConversationModelResponse(raw, responseSchema)'));
assert(runnerSource.includes("invalidModelOutputEnvelope('invalid_model_output_shape'"));
assert(runnerSource.includes("invalidModelOutputEnvelope('noncanonical_model_output'"));
assert(runnerSource.includes('noncanonicalOutputCount > 0'));

const prohibitedIndex = runnerSource.indexOf('detectProhibitedPatientConversationOutput(raw)');
const schemaIndex = runnerSource.indexOf('validatePatientConversationModelResponse(raw, responseSchema)');
const buildIndex = runnerSource.indexOf('const builtEnvelope = buildPatientConversationShadowEnvelope({');
assert(prohibitedIndex >= 0 && schemaIndex > prohibitedIndex);
assert(buildIndex > schemaIndex);

console.log('Patient conversation model response contract verified fail closed.');
