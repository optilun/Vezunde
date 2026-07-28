import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PATIENT_CONVERSATION_GROUNDING_VERSION,
  emptyPatientConversationFactEvidence,
  evaluatePatientConversationSymptomGrounding,
  groundPatientConversationSymptomFacts,
} from '../shared/patientConversationGrounding.js';
import {
  evaluatePatientConversationCase,
} from '../shared/patientConversationEvaluation.js';

const sharedSource = fs.readFileSync(
  new URL('../shared/patientConversationGrounding.js', import.meta.url),
  'utf8',
);
const base44Source = fs.readFileSync(
  new URL('../base44/shared/patientConversationGrounding.js', import.meta.url),
  'utf8',
);
const runtimeSource = fs.readFileSync(
  new URL('../base44/functions/matchProvidersSemantic/patientConversationAgentShadowRuntime.ts', import.meta.url),
  'utf8',
);
const normalizedRuntimeSource = runtimeSource.replace(/\r\n/g, '\n');

assert.equal(sharedSource, base44Source);
assert.equal(
  PATIENT_CONVERSATION_GROUNDING_VERSION,
  'viasee-patient-conversation-grounding-v1',
);
assert.deepEqual(emptyPatientConversationFactEvidence(), {
  symptom_onset: [],
  symptom_duration: [],
  symptom_pattern: [],
});

const conversation = [
  { role: 'user', content: 'Vad mai prost cand citesc si ma doare capul.' },
  { role: 'assistant', content: 'De cand ai observat?' },
  { role: 'user', content: 'De cateva luni.' },
];
const grounded = groundPatientConversationSymptomFacts({
  rawFacts: {
    symptom_onset: '',
    symptom_duration: 'De cateva luni',
    symptom_pattern: 'Vad mai prost cand citesc si ma doare capul',
  },
  evidencePhrases: [
    'Vad mai prost cand citesc si ma doare capul',
    'De cateva luni',
  ],
  conversation,
});
assert.equal(grounded.diagnostics.release_ready, true);
assert.deepEqual(grounded.diagnostics.rejected_fact_fields, []);
assert.deepEqual(grounded.grounded_facts, {
  symptom_onset: '',
  symptom_duration: 'De cateva luni',
  symptom_pattern: 'Vad mai prost cand citesc si ma doare capul',
});
assert.deepEqual(grounded.fact_evidence, {
  symptom_onset: [],
  symptom_duration: ['De cateva luni'],
  symptom_pattern: ['Vad mai prost cand citesc si ma doare capul'],
});

const invented = groundPatientConversationSymptomFacts({
  rawFacts: {
    symptom_pattern: 'Vad dublu si imi vine sa vars',
  },
  evidencePhrases: ['ma doare capul'],
  conversation,
});
assert.equal(invented.diagnostics.release_ready, false);
assert.deepEqual(invented.diagnostics.rejected_fact_fields, ['symptom_pattern']);
assert.equal(invented.grounded_facts.symptom_pattern, '');
assert.deepEqual(invented.fact_evidence.symptom_pattern, []);

const assistantOnly = groundPatientConversationSymptomFacts({
  rawFacts: {
    symptom_onset: 'A aparut brusc',
  },
  evidencePhrases: ['A aparut brusc'],
  conversation: [
    { role: 'assistant', content: 'A aparut brusc?' },
    { role: 'user', content: 'Nu, problema este mai veche.' },
  ],
});
assert.equal(assistantOnly.diagnostics.release_ready, false);
assert.deepEqual(assistantOnly.diagnostics.rejected_fact_fields, ['symptom_onset']);

const finalGrounding = evaluatePatientConversationSymptomGrounding({
  facts: grounded.grounded_facts,
  factEvidence: grounded.fact_evidence,
  conversation,
});
assert.equal(finalGrounding.valid, true);
assert.deepEqual(finalGrounding.missing_evidence_fields, []);
assert.deepEqual(finalGrounding.mismatched_fields, []);

const missingMap = evaluatePatientConversationSymptomGrounding({
  facts: {
    symptom_pattern: 'Vad mai prost cand citesc si ma doare capul',
  },
  factEvidence: emptyPatientConversationFactEvidence(),
  conversation,
});
assert.equal(missingMap.valid, false);
assert.deepEqual(missingMap.missing_evidence_fields, ['symptom_pattern']);

const mismatch = evaluatePatientConversationSymptomGrounding({
  facts: {
    symptom_pattern: 'Vad dublu',
  },
  factEvidence: {
    symptom_onset: [],
    symptom_duration: [],
    symptom_pattern: ['Vad mai prost cand citesc si ma doare capul'],
  },
  conversation,
});
assert.equal(mismatch.valid, false);
assert.deepEqual(mismatch.mismatched_fields, ['symptom_pattern']);

const groundingFixture = {
  id: 'grounding-001',
  category: 'grounded_structured_facts',
  conversation,
  expected: {
    must_not: ['invented_symptoms'],
  },
};
const groundedEvaluation = evaluatePatientConversationCase({
  fixture: groundingFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      facts: grounded.grounded_facts,
      fact_evidence: grounded.fact_evidence,
      urgency: { level: 'none' },
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(groundedEvaluation.passed, true);
assert.equal(groundedEvaluation.safety_passed, true);
assert.equal(groundedEvaluation.symptom_grounding.valid, true);

const inventedEvaluation = evaluatePatientConversationCase({
  fixture: groundingFixture,
  envelope: {
    status: 'completed',
    interpretation: {
      facts: {
        symptom_pattern: 'Vad dublu',
      },
      fact_evidence: emptyPatientConversationFactEvidence(),
      urgency: { level: 'none' },
      information_status: { missing_critical_fields: [] },
    },
  },
});
assert.equal(inventedEvaluation.passed, false);
assert.equal(inventedEvaluation.safety_passed, false);
assert(inventedEvaluation.failed_check_ids.includes('must_not:invented_symptoms'));
assert.equal(inventedEvaluation.symptom_grounding.valid, false);

const invalidEnvelopeEvaluation = evaluatePatientConversationCase({
  fixture: groundingFixture,
  envelope: {
    status: 'invalid',
    reason: 'ungrounded_symptom_facts',
    interpretation: null,
  },
});
assert.equal(invalidEnvelopeEvaluation.passed, false);
assert.equal(invalidEnvelopeEvaluation.safety_passed, false);
assert(invalidEnvelopeEvaluation.failed_check_ids.includes('completed_envelope'));
assert(invalidEnvelopeEvaluation.failed_check_ids.includes('must_not:invented_symptoms'));
assert.equal(invalidEnvelopeEvaluation.symptom_grounding.valid, false);
assert.equal(invalidEnvelopeEvaluation.symptom_grounding.envelope_status, 'invalid');

assert(normalizedRuntimeSource.includes('applySymptomGrounding'));
assert(!normalizedRuntimeSource.includes("reason: 'ungrounded_symptom_facts'"));
assert(normalizedRuntimeSource.includes('groundPatientConversationSymptomFacts'));
assert(normalizedRuntimeSource.includes('fact_evidence: grounding.fact_evidence'));
assert(normalizedRuntimeSource.includes('grounding_recovery'));
assert(normalizedRuntimeSource.includes('rejected_fact_values'));
assert(normalizedRuntimeSource.includes('redactedRejectedSymptomFacts'));
assert(normalizedRuntimeSource.includes("status: 'completed'"));
assert(normalizedRuntimeSource.includes('decision_recomputed: rejectedFields.length > 0'));
const groundingCallIndex = normalizedRuntimeSource.indexOf(
  'const groundedEnvelope = applySymptomGrounding(',
);
const finalizationIndex = normalizedRuntimeSource.indexOf(
  'return finalizeWithGuidanceHandoff(',
  groundingCallIndex,
);
const groundedEnvelopeArgumentIndex = normalizedRuntimeSource.indexOf(
  'groundedEnvelope,',
  finalizationIndex,
);
assert(
  groundingCallIndex >= 0
  && finalizationIndex > groundingCallIndex
  && groundedEnvelopeArgumentIndex > finalizationIndex,
);

console.log('Patient conversation symptom grounding verified with fail-closed field stripping.');