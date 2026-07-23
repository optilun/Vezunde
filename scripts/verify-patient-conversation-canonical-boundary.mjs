import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_CANONICAL_ADAPTER_VERSION,
  buildPatientProviderCandidateContract,
  locationProviderTypesFromProfileTypes,
  normalizePatientAgeGroup,
  normalizePatientSubject,
  providerProfileTypesFromServiceKeys,
  toGuidancePlannerAgeGroup,
  toLegacyPatientNeedSubject,
} from '../shared/patientConversationCanonicalAdapter.js';
import {
  PATIENT_CONVERSATION_CANONICAL_BOUNDARY_VERSION,
  applyPatientConversationCanonicalBoundary,
} from '../shared/patientConversationCanonicalBoundary.js';
import {
  applyPatientConversationCanonicalBoundary as applyBase44PatientConversationCanonicalBoundary,
} from '../base44/shared/patientConversationCanonicalBoundary.js';

const sharedAdapterSource = fs.readFileSync('shared/patientConversationCanonicalAdapter.js', 'utf8');
const base44AdapterSource = fs.readFileSync('base44/shared/patientConversationCanonicalAdapter.js', 'utf8');
const sharedBoundarySource = fs.readFileSync('shared/patientConversationCanonicalBoundary.js', 'utf8');
const base44BoundarySource = fs.readFileSync('base44/shared/patientConversationCanonicalBoundary.js', 'utf8');
const runtimeSource = fs.readFileSync(
  'base44/functions/matchProvidersSemantic/patientConversationAgentShadowCore.ts',
  'utf8',
);

assert.equal(sharedAdapterSource, base44AdapterSource);
assert.equal(sharedBoundarySource, base44BoundarySource);
assert.equal(
  PATIENT_CONVERSATION_CANONICAL_ADAPTER_VERSION,
  'viasee-patient-conversation-canonical-adapter-v1',
);
assert.equal(
  PATIENT_CONVERSATION_CANONICAL_BOUNDARY_VERSION,
  'viasee-patient-conversation-canonical-boundary-v1',
);

assert.equal(normalizePatientSubject('child'), 'child');
assert.equal(normalizePatientSubject('copil'), 'child');
assert.equal(normalizePatientSubject('adult'), 'adult');
assert.equal(normalizePatientSubject('valoare_necunoscuta'), 'unknown');
assert.equal(toLegacyPatientNeedSubject('child'), 'copil');
assert.equal(toLegacyPatientNeedSubject('copil'), 'copil');

assert.equal(normalizePatientAgeGroup('under_3'), 'sub_3_ani');
assert.equal(normalizePatientAgeGroup('sub_3_ani'), 'sub_3_ani');
assert.equal(normalizePatientAgeGroup('7_12'), '7_12_ani');
assert.equal(normalizePatientAgeGroup('7_12_ani'), '7_12_ani');
assert.equal(toGuidancePlannerAgeGroup('sub_3_ani'), 'under_3');
assert.equal(toGuidancePlannerAgeGroup('13_18_ani'), '13_18');
assert.equal(toGuidancePlannerAgeGroup('adult'), null);
assert.equal(toGuidancePlannerAgeGroup('unknown'), null);

const octProfiles = providerProfileTypesFromServiceKeys(['oct']);
assert(octProfiles.includes('ophthalmology_clinic'));
assert(octProfiles.includes('ophthalmology_office'));
assert(!octProfiles.includes('future_b2b_distributor'));

const opticalLocationTypes = locationProviderTypesFromProfileTypes([
  'independent_optical_store',
  'independent_optometrist',
]);
assert(opticalLocationTypes.includes('optica_medicala'));
assert(opticalLocationTypes.includes('optometrist_independent'));
assert(opticalLocationTypes.includes('cabinet_optometric'));
assert(!opticalLocationTypes.includes('ophthalmology_clinic'));

const providerContract = buildPatientProviderCandidateContract(['refraction']);
assert(providerContract.provider_profile_type_candidates.length > 0);
assert(providerContract.location_provider_type_candidates.length > 0);
assert(providerContract.provider_profile_type_candidates.every((value) => (
  !value.includes('_independent') || !value.endsWith('_medicala')
)));
assert(providerContract.location_provider_type_candidates.every((value) => (
  [
    'optica_medicala',
    'clinica_oftalmologica',
    'cabinet_oftalmologic',
    'cabinet_optometric',
    'laborator_optic',
    'optometrist_independent',
    'medic_oftalmolog_independent',
  ].includes(value)
)));

const interpretation = {
  primary_intent: 'control_copil',
  service_keys: ['children_eye_exam'],
  provider_type_candidates: ['invalid_model_profile'],
  facts: {
    for_whom: 'copil',
    age_group: '7_12',
    locality: { city: 'Sibiu' },
  },
  urgency: { level: 'none' },
  information_status: {
    sufficient_for_search: true,
    sufficient_for_specialist_message: false,
    missing_critical_fields: [],
  },
  next_action: 'search_providers',
};
const canonical = applyPatientConversationCanonicalBoundary(interpretation);
assert.equal(canonical.interpretation.facts.for_whom, 'child');
assert.equal(canonical.interpretation.facts.age_group, '7_12_ani');
assert.deepEqual(
  canonical.interpretation.provider_type_candidates,
  canonical.interpretation.provider_profile_type_candidates,
);
assert(canonical.interpretation.provider_profile_type_candidates.includes('ophthalmology_clinic'));
assert(canonical.interpretation.location_provider_type_candidates.includes('clinica_oftalmologica'));
assert.equal(canonical.interpretation.provider_type_candidates.includes('invalid_model_profile'), false);
assert.equal(canonical.diagnostics.canonical_subject, 'child');
assert.equal(canonical.diagnostics.legacy_patient_need_subject, 'copil');
assert.equal(canonical.diagnostics.guidance_planner_age_group, '7_12');
assert.equal(canonical.diagnostics.compatibility_provider_type_alias, true);

const base44Canonical = applyBase44PatientConversationCanonicalBoundary(interpretation);
assert.deepEqual(base44Canonical, canonical);

assert(runtimeSource.includes(
  "from '../../shared/patientConversationCanonicalBoundary.js';",
));
assert(runtimeSource.includes('const canonicalEnvelope = applyCanonicalBoundary(deterministicEnvelope);'));
assert(runtimeSource.includes('return applyCanonicalBoundary({'));
const decisionIndex = runtimeSource.indexOf(
  'const deterministicEnvelope = applyDeterministicDecisionPolicy(',
);
const canonicalIndex = runtimeSource.indexOf(
  'const canonicalEnvelope = applyCanonicalBoundary(deterministicEnvelope);',
);
assert(decisionIndex >= 0 && canonicalIndex > decisionIndex);
assert(runtimeSource.includes('canonical_boundary: canonical.diagnostics'));

console.log('Canonical patient, profile-type, and location-provider-type boundaries verified.');
