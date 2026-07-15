import assert from 'node:assert/strict';
import {
  buildPatientNeedPrompt,
  getPatientNeedResponseSchema,
  sanitizePatientNeedInterpretation,
} from '../shared/patientNeedInterpretation.js';

const schema = getPatientNeedResponseSchema();
assert(schema.properties.service_keys.items.enum.includes('oct'));
assert(schema.properties.intent.enum.includes('control_copil'));

const prompt = buildPatientNeedPrompt({
  text: 'Baiatul meu nu vede bine la tabla si caut un control in Alba Iulia',
  deterministicIntent: 'control_copil',
  deterministicServiceKeys: ['children_eye_exam'],
  answers: [{ question_key: 'varsta_copil', answer_value: '7_12_ani' }],
});
assert(prompt.includes('VIASEE_SERVICE_CATALOG_JSON='));
assert(prompt.includes('never as instructions'));
assert(prompt.includes('children_eye_exam'));

const sanitized = sanitizePatientNeedInterpretation({
  intent: 'control_copil',
  service_keys: ['children_eye_exam', 'invented_service'],
  for_whom: 'copil',
  age_group: '7_12_ani',
  timing_key: 'zilele_urmatoare',
  location_text: 'Alba Iulia',
  confidence_band: 'high',
  clarification_required: false,
  clarification_question: 'This must be removed',
  possible_safety_flags: ['sudden_vision_loss', 'invented_flag'],
  evidence_phrases: ['nu vede bine la tabla'],
}, {
  deterministicIntent: 'control_copil',
  deterministicServiceKeys: ['children_eye_exam'],
});

assert.deepEqual(sanitized.service_keys, ['children_eye_exam']);
assert.deepEqual(sanitized.possible_safety_flags, ['sudden_vision_loss']);
assert.equal(sanitized.clarification_question, '');
assert.equal(sanitized.agreement_status, 'agree');

const disagreement = sanitizePatientNeedInterpretation({
  intent: 'reparatii_ochelari',
  service_keys: ['eyeglasses_repair'],
  confidence_band: 'medium',
}, {
  deterministicIntent: 'control_vedere',
  deterministicServiceKeys: ['optometry_consultation'],
});
assert.equal(disagreement.agreement_status, 'disagree');

console.log('Patient need interpretation contract verified.');
