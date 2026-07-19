import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildIntentConfirmationProposal } from '../src/lib/patientIntentConfirmation.js';

const allowedIntents = [
  'control_vedere',
  'control_copil',
  'ochelari_lentile',
  'lentile_contact',
  'reparatii_ochelari',
  'simptome_oftalmologice',
  'investigatii',
  'unknown',
];

const confirmed = buildIntentConfirmationProposal({
  status: 'completed',
  interpretation: {
    version: 'patient-need-ai-v1',
    intent: 'reparatii_ochelari',
    service_keys: ['reparatii_ochelari', 'reglaj_rame'],
    confidence_band: 'medium',
    agreement_status: 'agree',
    clarification_required: false,
    possible_safety_flags: [],
  },
}, { allowedIntents, deterministicIntent: 'reparatii_ochelari' });
assert.equal(confirmed.status, 'confirm');
assert.equal(confirmed.intent, 'reparatii_ochelari');
assert.deepEqual(confirmed.service_keys, ['reparatii_ochelari', 'reglaj_rame']);

const lowConfidence = buildIntentConfirmationProposal({
  status: 'completed',
  interpretation: {
    intent: 'simptome_oftalmologice',
    service_keys: ['consult_oftalmologic'],
    confidence_band: 'low',
    agreement_status: 'partial',
    clarification_required: true,
    clarification_question: 'Cauti un control de vedere sau o evaluare medicala?',
    possible_safety_flags: ['severe_eye_pain'],
  },
}, { allowedIntents, deterministicIntent: 'control_vedere' });
assert.equal(lowConfidence.status, 'manual_choice');
assert.equal(lowConfidence.clarification_question, 'Cauti un control de vedere sau o evaluare medicala?');
assert.deepEqual(lowConfidence.possible_safety_flags, ['severe_eye_pain']);

const unavailable = buildIntentConfirmationProposal({
  status: 'unavailable',
  reason: 'ai_interpretation_unavailable',
}, { allowedIntents, deterministicIntent: 'control_vedere' });
assert.equal(unavailable.status, 'fallback');
assert.equal(unavailable.intent, 'control_vedere');

const unknownIntent = buildIntentConfirmationProposal({
  status: 'completed',
  interpretation: {
    intent: 'unknown',
    service_keys: [],
    confidence_band: 'high',
    agreement_status: 'not_comparable',
    clarification_required: false,
    possible_safety_flags: [],
  },
}, { allowedIntents, deterministicIntent: null });
assert.equal(unknownIntent.status, 'manual_choice');
assert.equal(unknownIntent.intent, null);

const cardSource = await readFile(new URL('../src/components/intake2/ConversationalCard.jsx', import.meta.url), 'utf8');
const semanticSource = await readFile(new URL('../src/lib/providerSemanticSearch.js', import.meta.url), 'utf8');
const confirmationSource = await readFile(new URL('../src/components/intake2/PatientIntentConfirmation.jsx', import.meta.url), 'utf8');

assert.match(cardSource, /phase !== "interpreting"/);
assert.match(cardSource, /setPhase\("confirm_intent"\)/);
assert.match(cardSource, /handleConfirmInterpretation/);
assert.match(cardSource, /handleCorrectInterpretation/);
assert.match(cardSource, /PatientIntentConfirmation/);
assert.match(cardSource, /interpretPatientNeedForConfirmation/);
assert.match(cardSource, /matchProvidersWithSemanticFallback/);

const interpretationCall = cardSource.indexOf('const interpretationResponse = await interpretPatientNeedForConfirmation');
const matchingCall = cardSource.indexOf('const res = await matchProvidersWithSemanticFallback');
assert.ok(interpretationCall > -1, 'controlled AI interpretation call is missing');
assert.ok(matchingCall > interpretationCall, 'provider matching must happen after interpretation and confirmation flow');

assert.match(semanticSource, /mode: "interpret_only"/);
assert.match(semanticSource, /patient_need_interpretation_confirmation/);
assert.match(semanticSource, /rememberCompletedConfirmation/);
assert.match(semanticSource, /hasRecentCompletedConfirmation/);
assert.match(semanticSource, /skipped_duplicate_confirmation/);
assert.match(confirmationSource, /AI-ul nu alege furnizorii si nu stabileste ordinea rezultatelor/);
assert.match(confirmationSource, /possible_safety_flags/);

console.log('Patient AI intent confirmation checks passed.');
