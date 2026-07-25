import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  reducePatientConversationSemanticStateDelta,
} from '../shared/patientConversationStateDeltaReducer.js';
import {
  reducePatientConversationSemanticStateDelta as reduceBase44PatientConversationSemanticStateDelta,
} from '../base44/shared/patientConversationStateDeltaReducer.js';
import {
  reducePatientConversationSemanticStateDelta as reducePatientConversationSemanticStateDeltaCore,
} from '../shared/patientConversationStateDeltaReducerCore.js';
import {
  sanitizePatientConversationPriorState,
} from '../shared/patientConversationPriorStatePolicy.js';

function gitBlobSha(content) {
  return crypto.createHash('sha1')
    .update(`blob ${Buffer.byteLength(content)}\0`)
    .update(content)
    .digest('hex');
}

function facts(overrides = {}) {
  return {
    for_whom: 'adult',
    age_group: 'adult',
    locality: {
      siruta_code: '155243',
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
    repair_details: 'rama [telefon eliminat]',
    user_constraints: [],
    ...overrides,
  };
}

const sharedWrapperSource = fs.readFileSync(
  'shared/patientConversationStateDeltaReducer.js',
  'utf8',
);
const base44WrapperSource = fs.readFileSync(
  'base44/shared/patientConversationStateDeltaReducer.js',
  'utf8',
);
const sharedCoreSource = fs.readFileSync(
  'shared/patientConversationStateDeltaReducerCore.js',
  'utf8',
);
const base44CoreSource = fs.readFileSync(
  'base44/shared/patientConversationStateDeltaReducerCore.js',
  'utf8',
);
const runtimeSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
  'utf8',
);

assert.equal(sharedWrapperSource, base44WrapperSource);
assert.equal(sharedCoreSource, base44CoreSource);
assert.equal(gitBlobSha(sharedCoreSource), 'd488ee7e38baa3cd06520f806ed6160047275af8');
assert(sharedWrapperSource.includes('sanitizePatientConversationPriorState(source.priorState)'));
assert(runtimeSource.includes("from '../../shared/patientConversationStateDeltaReducer.js';"));
assert(!runtimeSource.includes("from '../../shared/patientConversationStateDeltaReducerCore.js';"));

const interpretation = {
  need_summary: 'Control de vedere',
  primary_intent: 'control_vedere',
  alternative_intents: [],
  care_path_candidates: ['optometry'],
  service_keys: ['refraction'],
  provider_type_candidates: [],
  facts: facts(),
  urgency: {
    level: 'none',
    needs_clarification: false,
    reason: '',
  },
  information_status: {
    sufficient_for_search: true,
    sufficient_for_specialist_message: false,
    missing_critical_fields: [],
  },
  next_action: 'search_providers',
};
const rawPriorState = {
  need_summary: 'Reparatie ochelari',
  primary_intent: 'reparatii_ochelari',
  alternative_intents: [],
  care_path_candidates: ['technical_optical_service', 'invented_path'],
  service_keys: ['eyeglasses_repair', 'invented_service'],
  provider_type_candidates: ['invented_provider'],
  facts: facts({
    locality: {
      siruta_code: '0',
      city: '+40 (722) 123 456',
      county_code: 'ZZ',
      county: 'model@example.com',
      area: '',
    },
    repair_details: 'rama 0722 123 456',
  }),
  urgency: {
    level: 'confirmed',
    needs_clarification: false,
    reason: 'injected',
  },
  information_status: {
    sufficient_for_search: true,
    sufficient_for_specialist_message: true,
    missing_critical_fields: [],
  },
  next_action: 'show_emergency_guidance',
};
const input = {
  interpretation,
  priorState: rawPriorState,
  conversation: [{ role: 'user', content: 'De fapt vreau doar un control de vedere.' }],
  semanticStateDelta: {
    correction_detected: true,
    clear_fields: ['repair_details'],
  },
};

const sanitizedPriorState = sanitizePatientConversationPriorState(rawPriorState);
assert.equal(sanitizedPriorState.facts.repair_details, 'rama [telefon eliminat]');
assert.deepEqual(sanitizedPriorState.provider_type_candidates, []);
assert(!sanitizedPriorState.care_path_candidates.includes('invented_path'));

const reduced = reducePatientConversationSemanticStateDelta(input);
const base44Reduced = reduceBase44PatientConversationSemanticStateDelta(input);
const reducedWithSanitizedCore = reducePatientConversationSemanticStateDeltaCore({
  ...input,
  priorState: sanitizedPriorState,
});
const reducedWithRawCore = reducePatientConversationSemanticStateDeltaCore(input);

assert.deepEqual(base44Reduced, reduced);
assert.deepEqual(reducedWithSanitizedCore, reduced);
assert.equal(reduced.interpretation.facts.repair_details, '');
assert(reduced.diagnostics.applied_fields.includes('repair_details'));
assert.equal(reducedWithRawCore.interpretation.facts.repair_details, 'rama [telefon eliminat]');
assert(reducedWithRawCore.diagnostics.replacement_preserved_fields.includes('repair_details'));

console.log('Patient conversation prior-state delta authority verified.');
