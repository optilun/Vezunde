import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_REQUEST_STATUS_CONTRACT_VERSION,
  sanitizePatientProviderResponse,
  sanitizePatientRequestStatus,
} from '../shared/patientRequestStatusPolicy.js';

assert.equal(PATIENT_REQUEST_STATUS_CONTRACT_VERSION, 'patient-request-status-v1');

const request = sanitizePatientRequestStatus({
  id: 'request-1',
  public_reference: 'VIA-123',
  status: 'pregatita_pentru_distribuire',
  intent: 'reparatii_ochelari',
  city: 'Timisoara',
  county: 'Timis',
  original_message: 'Mesaj privat',
  requester_user_id: 'user-secret',
  contact_email_hash: 'hash-secret',
  access_token_hash: 'token-secret',
});
assert.equal(request.public_reference, 'VIA-123');
for (const forbidden of ['original_message', 'requester_user_id', 'contact_email_hash', 'access_token_hash']) {
  assert.equal(Object.hasOwn(request, forbidden), false, `${forbidden} nu trebuie returnat in status`);
}

const response = sanitizePatientProviderResponse({
  id: 'response-1',
  lead_id: 'lead-secret',
  request_id: 'request-secret',
  responder_user_id: 'user-secret',
  organization_id: 'org-secret',
  location_id: 'location-1',
  response_type: 'can_help',
  submitted_at: '2026-07-19T12:00:00.000Z',
}, {
  id: 'location-1',
  public_display_name: 'Optica Test',
  locality_name: 'Timisoara',
  status: 'publicata',
  active_status: 'activa',
  profile_control_status: 'claimed',
});
assert.equal(response.location_name, 'Optica Test');
assert.equal(response.response_label, 'Poate ajuta');
assert.equal(response.profile_available, true);
for (const forbidden of ['lead_id', 'request_id', 'responder_user_id', 'organization_id']) {
  assert.equal(Object.hasOwn(response, forbidden), false, `${forbidden} nu trebuie returnat clientului`);
}

const hiddenProfile = sanitizePatientProviderResponse({ response_type: 'needs_details' }, {
  id: 'location-2',
  name: 'Locatie suspendata',
  status: 'publicata',
  active_status: 'activa',
  profile_control_status: 'suspended',
});
assert.equal(hiddenProfile.profile_available, false);

const backend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');
const submission = await readFile(new URL('../src/components/intake2/PatientRequestSubmission.jsx', import.meta.url), 'utf8');

assert.match(backend, /sha256\(accessToken\)/);
assert.match(backend, /PatientRequestContact\.filter/);
assert.match(backend, /access_token_hash: tokenHash/);
assert.match(backend, /status: 'active'/);
assert.match(backend, /ProviderLeadResponse\.filter/);
assert.match(backend, /request_id: requestId/);
assert.match(backend, /sanitizePatientRequestStatus/);
assert.match(backend, /sanitizePatientProviderResponse/);
assert.match(backend, /contact_sharing_enabled: false/);
assert.match(backend, /conversation_enabled: false/);
assert.doesNotMatch(backend, /base44\.auth\.me\(\)/);
assert.doesNotMatch(backend, /contact_email:|contact_phone:|original_message:|responder_user_id:/);

assert.match(client, /getPatientRequestStatus/);
assert.match(client, /request_access_token: requestAccessToken/);
assert.match(component, /getPatientRequestStatus/);
assert.match(component, /Verifică răspunsurile/);
assert.match(component, /Datele de contact și conversația rămân blocate/);
assert.doesNotMatch(component, /contact_email|contact_phone|original_message|responder_user_id/);
assert.match(submission, /PatientRequestResponseStatus/);
assert.match(submission, /requestId=\{success\.request_id\}/);

console.log('Patient request status checks passed.');
