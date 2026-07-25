import assert from 'node:assert/strict';
import {
  PATIENT_INTAKE_HISTORY_LIMIT,
  PATIENT_INTAKE_SESSION_STORAGE_KEY,
  PATIENT_INTAKE_SESSION_TTL_MS,
  PATIENT_INTAKE_SESSION_VERSION,
  clearPatientIntakeSession,
  createPatientIntakeEntrySignature,
  createPatientIntakeSnapshot,
  readPatientIntakeSession,
  restorablePatientIntakePhase,
  validatePatientIntakeSnapshot,
  writePatientIntakeSession,
} from '../src/lib/patientIntakeSession.js';
import {
  abandonAllPatientRequestIdempotency,
  completePatientRequestIdempotency,
  fingerprintPatientRequestDraft,
  getOrCreatePatientRequestIdempotency,
} from '../src/lib/patientRequestIdempotency.js';
import {
  createPatientOperationGuard,
  isPatientOperationTimeout,
  withPatientOperationTimeout,
} from '../src/lib/patientOperationControl.js';
import { planPatientShadowInterpretation } from '../src/lib/patientShadowInterpretation.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }

  key(index) {
    return [...this.values.keys()][index] || null;
  }
}

const unavailableStorage = {
  get length() { throw new Error('storage unavailable'); },
  getItem() { throw new Error('storage unavailable'); },
  setItem() { throw new Error('storage unavailable'); },
  removeItem() { throw new Error('storage unavailable'); },
  key() { throw new Error('storage unavailable'); },
};

const now = 1_800_000_000_000;
const guidedSignature = createPatientIntakeEntrySignature({
  initialMessage: '',
  initialIntent: 'reparatii_ochelari',
  search: '?intent=reparatii_ochelari&source=hero',
});
const freeTextSignature = createPatientIntakeEntrySignature({
  initialMessage: 'Caut reparatie pentru o rama rupta',
  initialIntent: null,
  search: '?q=Caut+reparatie&source=hero',
});
assert.notEqual(guidedSignature, freeTextSignature);
assert.notEqual(
  guidedSignature,
  createPatientIntakeEntrySignature({
    initialMessage: '',
    initialIntent: 'control_vedere',
    search: '?intent=control_vedere&source=hero',
  }),
);
assert.notEqual(
  freeTextSignature,
  createPatientIntakeEntrySignature({
    initialMessage: 'Caut reparatie pentru o rama rupta',
    initialIntent: null,
    search: '?q=Caut+reparatie&source=directory',
  }),
);

const state = {
  intent: 'reparatii_ochelari',
  answers: [
    { question_key: 'ce_deteriorat', answer_value: 'rama_rupta' },
    { question_key: 'locatie', answer_value: 'Timisoara' },
  ],
  serviceKeys: ['reparatii_ochelari', 'reglaj_rame'],
  explicitServiceKeys: ['frame_repair'],
  questionHistory: ['repair_type', 'locality'],
  city: 'Timisoara',
  scope: 'locality',
  locality: {
    siruta_code: '155243',
    city_name: 'Timisoara',
    county_name: 'Timis',
    county_code: 'TM',
  },
  clientAddressText: 'Timisoara',
};
const requestDraft = {
  contract_version: 'patient-request-draft-v1',
  questionnaire_version: 'patient-questionnaire-v1',
  questionnaire_key: 'patient-reparatii_ochelari-v1',
  intent: 'reparatii_ochelari',
  intent_label: 'Reparatii ochelari',
  original_message: 'Caut reparatie pentru o rama rupta',
  service_keys: ['reparatii_ochelari'],
  location_scope: 'locality',
  city: 'Timisoara',
  county: 'Timis',
  county_code: 'TM',
  locality_siruta_code: '155243',
  client_address_text: 'Timisoara',
  answers: state.answers,
  interpretation: null,
};
const history = Array.from({ length: 30 }, (_, index) => ({
  ...state,
  answers: state.answers.slice(0, index % 2),
}));
const snapshot = createPatientIntakeSnapshot({
  entrySignature: guidedSignature,
  initialMessage: '',
  initialIntent: 'reparatii_ochelari',
  state,
  history,
  phase: 'submitting',
  requestDraft,
  timestamp: now,
});
assert.equal(snapshot.version, PATIENT_INTAKE_SESSION_VERSION);
assert.equal(snapshot.phase, 'review');
assert.equal(snapshot.history.length, PATIENT_INTAKE_HISTORY_LIMIT);
assert.equal(snapshot.locality.siruta_code, '155243');
assert.equal(snapshot.city, 'Timisoara');
assert.deepEqual(snapshot.explicitServiceKeys, ['frame_repair']);
assert.deepEqual(snapshot.questionHistory, ['repair_type', 'locality', 'ce_deteriorat', 'locatie']);
assert.equal(snapshot.requestDraft.locality_siruta_code, '155243');
assert.equal(Object.hasOwn(snapshot, 'results'), false);
assert.equal(Object.hasOwn(snapshot, 'email'), false);
assert.equal(Object.hasOwn(snapshot, 'phone'), false);
assert.equal(Object.hasOwn(snapshot, 'name'), false);
assert.equal(Object.hasOwn(snapshot, 'access_token'), false);

const storage = new MemoryStorage();
assert.equal(writePatientIntakeSession(snapshot, storage), true);
const restored = readPatientIntakeSession({
  entrySignature: guidedSignature,
  storage,
  now: now + 1_000,
});
assert.equal(restored.phase, 'review');
assert.deepEqual(restored.answers, state.answers);
assert.deepEqual(restored.questionHistory, snapshot.questionHistory);
assert.deepEqual(restored.explicitServiceKeys, ['frame_repair']);
assert.equal(restored.locality.siruta_code, '155243');

const expiredStorage = new MemoryStorage();
writePatientIntakeSession(snapshot, expiredStorage);
assert.equal(readPatientIntakeSession({
  entrySignature: guidedSignature,
  storage: expiredStorage,
  now: now + PATIENT_INTAKE_SESSION_TTL_MS + 1,
}), null);
assert.equal(expiredStorage.getItem(PATIENT_INTAKE_SESSION_STORAGE_KEY), null);

const incompatibleStorage = new MemoryStorage();
incompatibleStorage.setItem(PATIENT_INTAKE_SESSION_STORAGE_KEY, JSON.stringify({
  ...snapshot,
  version: PATIENT_INTAKE_SESSION_VERSION + 1,
}));
assert.equal(readPatientIntakeSession({
  entrySignature: guidedSignature,
  storage: incompatibleStorage,
  now,
}), null);

const corruptStorage = new MemoryStorage();
corruptStorage.setItem(PATIENT_INTAKE_SESSION_STORAGE_KEY, '{broken-json');
assert.equal(readPatientIntakeSession({
  entrySignature: guidedSignature,
  storage: corruptStorage,
  now,
}), null);
assert.equal(corruptStorage.getItem(PATIENT_INTAKE_SESSION_STORAGE_KEY), null);

const foreignEntryStorage = new MemoryStorage();
writePatientIntakeSession(snapshot, foreignEntryStorage);
assert.equal(readPatientIntakeSession({
  entrySignature: freeTextSignature,
  storage: foreignEntryStorage,
  now,
}), null);
assert.equal(foreignEntryStorage.getItem(PATIENT_INTAKE_SESSION_STORAGE_KEY), null);

assert.equal(restorablePatientIntakePhase('questions', null), 'questions');
assert.equal(restorablePatientIntakePhase('review', requestDraft), 'review');
assert.equal(restorablePatientIntakePhase('submitting', requestDraft), 'review');
assert.equal(restorablePatientIntakePhase('error', requestDraft), 'review');
assert.equal(restorablePatientIntakePhase('results', requestDraft), 'review');
assert.equal(restorablePatientIntakePhase('submitting', null), 'questions');
assert.equal(restorablePatientIntakePhase('confirm_intent', null, {
  initialMessage: 'Am nevoie de un control',
  initialIntent: null,
}), 'interpreting');
assert.equal(validatePatientIntakeSnapshot(snapshot, {
  entrySignature: guidedSignature,
  now,
})?.phase, 'review');

assert.equal(writePatientIntakeSession(snapshot, unavailableStorage), false);
assert.equal(readPatientIntakeSession({
  entrySignature: guidedSignature,
  storage: unavailableStorage,
  now,
}), null);
assert.doesNotThrow(() => clearPatientIntakeSession(unavailableStorage));

const draftIdentity = {
  requestDraft,
  detailedMessage: 'Rama este rupta la balama si am nevoie de reparatie.',
  contact: {
    name: 'Alex Test',
    email: 'alex@example.com',
    phone: '0722000000',
    preference: 'either',
  },
};
const fingerprint = fingerprintPatientRequestDraft(draftIdentity);
assert.equal(fingerprint, fingerprintPatientRequestDraft(structuredClone(draftIdentity)));
assert.doesNotMatch(fingerprint, /alex|example|0722/i);
for (const changed of [
  { requestDraft: { ...requestDraft, intent: 'control_vedere' } },
  { requestDraft: { ...requestDraft, answers: [{ question_key: 'ce_deteriorat', answer_value: 'lentila' }] } },
  { requestDraft: { ...requestDraft, locality_siruta_code: '999999' } },
  { requestDraft: { ...requestDraft, service_keys: ['reglaj_rame'] } },
  { detailedMessage: 'Un mesaj material diferit pentru cerere.' },
  { contact: { ...draftIdentity.contact, email: 'alta@example.com' } },
]) {
  assert.notEqual(
    fingerprint,
    fingerprintPatientRequestDraft({ ...draftIdentity, ...changed }),
  );
}

abandonAllPatientRequestIdempotency({ storage });
let generatedKeys = 0;
const keyFactory = () => `patient:test-key-${++generatedKeys}:1234567890`;
const firstAllocation = getOrCreatePatientRequestIdempotency(draftIdentity, {
  storage,
  createKey: keyFactory,
  now,
});
const retryAllocation = getOrCreatePatientRequestIdempotency(structuredClone(draftIdentity), {
  storage,
  createKey: keyFactory,
  now: now + 10_000,
});
assert.equal(firstAllocation.idempotencyKey, retryAllocation.idempotencyKey);
assert.equal(retryAllocation.reused, true);
assert.equal(generatedKeys, 1);

const changedAllocation = getOrCreatePatientRequestIdempotency({
  ...draftIdentity,
  detailedMessage: 'Mesaj schimbat material pentru o cerere noua.',
}, {
  storage,
  createKey: keyFactory,
  now,
});
assert.notEqual(changedAllocation.idempotencyKey, firstAllocation.idempotencyKey);
assert.equal(generatedKeys, 2);

completePatientRequestIdempotency({
  fingerprint: firstAllocation.fingerprint,
  storage,
});
const afterSuccessAllocation = getOrCreatePatientRequestIdempotency(draftIdentity, {
  storage,
  createKey: keyFactory,
  now: now + 20_000,
});
assert.notEqual(afterSuccessAllocation.idempotencyKey, firstAllocation.idempotencyKey);

const unavailableFirst = getOrCreatePatientRequestIdempotency({
  ...draftIdentity,
  detailedMessage: 'Draft pentru storage indisponibil.',
}, {
  storage: unavailableStorage,
  createKey: keyFactory,
});
const unavailableRetry = getOrCreatePatientRequestIdempotency({
  ...draftIdentity,
  detailedMessage: 'Draft pentru storage indisponibil.',
}, {
  storage: unavailableStorage,
  createKey: keyFactory,
});
assert.equal(unavailableRetry.idempotencyKey, unavailableFirst.idempotencyKey);

await assert.rejects(
  withPatientOperationTimeout(
    () => new Promise((resolve) => setTimeout(resolve, 40)),
    { timeoutMs: 5, operation: 'patient_need_interpretation', requestId: 'interpretation:1' },
  ),
  (error) => isPatientOperationTimeout(error)
    && error.operation === 'patient_need_interpretation'
    && error.requestId === 'interpretation:1',
);
await assert.rejects(
  withPatientOperationTimeout(
    () => new Promise(() => {}),
    { timeoutMs: 5, operation: 'patient_provider_matching_semantic', requestId: 'matching:1' },
  ),
  (error) => isPatientOperationTimeout(error)
    && error.operation === 'patient_provider_matching_semantic',
);

const guard = createPatientOperationGuard();
const staleRequest = guard.begin();
const retryRequest = guard.begin();
assert.equal(guard.isCurrent(staleRequest), false);
assert.equal(guard.isCurrent(retryRequest), true);
const secondRetry = guard.begin();
assert.equal(guard.isCurrent(retryRequest), false);
assert.equal(guard.isCurrent(secondRetry), true);
guard.dispose();
assert.equal(guard.isCurrent(secondRetry), false);

let lateBackendCompleted = false;
const backendPromise = new Promise((resolve) => {
  setTimeout(() => {
    lateBackendCompleted = true;
    resolve({ request_id: 'request-1' });
  }, 20);
});
await assert.rejects(
  withPatientOperationTimeout(
    () => backendPromise,
    { timeoutMs: 5, operation: 'create_patient_request', requestId: 'create:1' },
  ),
  isPatientOperationTimeout,
);
await new Promise((resolve) => setTimeout(resolve, 25));
assert.equal(lateBackendCompleted, true, 'timeoutul clientului nu trebuie sa presupuna anularea serverului');

const reloadAllocation = getOrCreatePatientRequestIdempotency(draftIdentity, {
  storage,
  createKey: keyFactory,
});
const reloadRetryAllocation = getOrCreatePatientRequestIdempotency(draftIdentity, {
  storage,
  createKey: keyFactory,
});
assert.equal(reloadRetryAllocation.idempotencyKey, reloadAllocation.idempotencyKey);

const createdByKey = new Map();
const simulatedCreatePatientRequest = (key) => {
  if (!createdByKey.has(key)) createdByKey.set(key, { request_id: `request-${createdByKey.size + 1}` });
  return createdByKey.get(key);
};
const firstCreate = simulatedCreatePatientRequest(reloadAllocation.idempotencyKey);
const retryCreate = simulatedCreatePatientRequest(reloadRetryAllocation.idempotencyKey);
assert.equal(firstCreate.request_id, retryCreate.request_id);
assert.equal(createdByKey.size, 1, 'Retry pentru acelasi draft nu trebuie sa creeze o a doua cerere');

const reusableShadow = planPatientShadowInterpretation({
  status: 'confirm',
  intent: 'reparatii_ochelari',
  version: 'patient-need-ai-v1',
  confidence_band: 'high',
  agreement_status: 'agree',
  service_keys: ['reparatii_ochelari'],
});
assert.equal(reusableShadow.shouldRequest, false);
assert.equal(reusableShadow.analyticsStatus, 'reused_completed_confirmation');
assert.equal(planPatientShadowInterpretation(null).shouldRequest, true);
assert.equal(planPatientShadowInterpretation({ status: 'fallback' }).shouldRequest, true);

clearPatientIntakeSession(storage);
assert.equal(storage.getItem(PATIENT_INTAKE_SESSION_STORAGE_KEY), null);
abandonAllPatientRequestIdempotency({ storage });
abandonAllPatientRequestIdempotency({ storage: unavailableStorage });

console.log('Patient intake session hardening checks passed.');
