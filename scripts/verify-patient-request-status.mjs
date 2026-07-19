import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PATIENT_REQUEST_STATUS_CONTRACT_VERSION,
  sanitizePatientProviderResponse,
  sanitizePatientRequestStatus,
} from '../shared/patientRequestStatusPolicy.js';

assert.equal(PATIENT_REQUEST_STATUS_CONTRACT_VERSION, 'patient-request-status-v2');

const request = sanitizePatientRequestStatus({
  id: 'request-1',
  public_reference: 'VIA-123',
  status: 'pregatita_pentru_distribuire',
  intent: 'reparatii_ochelari',
  city: 'Timisoara',
  county: 'Timis',
  original_message: 'Mesaj privat',
  detailed_message: 'Mesaj detaliat privat',
  requester_user_id: 'user-secret',
  contact_email_hash: 'hash-secret',
  contact_identity_hash: 'identity-secret',
});
assert.equal(request.public_reference, 'VIA-123');
for (const forbidden of ['original_message', 'detailed_message', 'requester_user_id', 'contact_email_hash', 'contact_identity_hash']) {
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
}, {
  location_id: 'location-1',
  status: 'approved',
});
assert.equal(response.location_name, 'Optica Test');
assert.equal(response.response_label, 'Poate ajuta');
assert.equal(response.profile_available, true);
assert.equal(response.contact_share_allowed, true);
assert.equal(response.contact_share_status, 'approved');
for (const forbidden of ['lead_id', 'request_id', 'responder_user_id', 'organization_id']) {
  assert.equal(Object.hasOwn(response, forbidden), false, `${forbidden} nu trebuie returnat clientului`);
}

const declined = sanitizePatientProviderResponse({ response_type: 'cannot_help' }, {
  id: 'location-3',
  name: 'Locatie indisponibila',
  status: 'publicata',
  active_status: 'activa',
  profile_control_status: 'claimed',
}, { status: 'approved' });
assert.equal(declined.contact_share_allowed, false);
assert.equal(declined.contact_share_status, 'not_approved');

const backend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');
const chatComponent = await readFile(new URL('../src/components/intake2/PatientRequestChat.jsx', import.meta.url), 'utf8');
const submission = await readFile(new URL('../src/components/intake2/PatientRequestSubmission.jsx', import.meta.url), 'utf8');

assert.match(backend, /sha256\(accessToken\)/);
assert.match(backend, /PatientRequestContact\.filter/);
assert.match(backend, /ProviderLeadResponse\.filter/);
assert.match(backend, /ContactShareApproval\.filter/);
assert.match(backend, /contact_phone_available/);
assert.match(backend, /phone_sharing_enabled/);
assert.match(backend, /conversation_enabled: false/);
assert.doesNotMatch(backend, /base44\.auth\.me\(\)/);
assert.doesNotMatch(backend, /contact_phone:|original_message:|detailed_message:|responder_user_id:/);

assert.match(client, /getPatientRequestStatus/);
assert.match(client, /patientControlledChat/);
assert.match(component, /Verifică răspunsurile/);
assert.match(component, /controlezi separat telefonul și deschiderea chatului/);
assert.match(component, /Permite acestei locații accesul la telefon/);
assert.match(component, /Retrage accesul la telefon/);
assert.match(component, /status\.contact_phone_available === true/);
assert.match(component, /<PatientRequestChat/);
assert.doesNotMatch(component, /response\.contact_phone|contact_phone\s*:|original_message|detailed_message|responder_user_id/);
assert.match(chatComponent, /Deschide conversația/);
assert.match(chatComponent, /Nu introduce telefon, email sau linkuri/);
assert.doesNotMatch(chatComponent, /base44\.entities\.PatientRequestMessage|base44\.entities\.PatientRequestConversation/);
assert.match(submission, /PatientRequestResponseStatus/);
assert.match(submission, /requestId=\{success\.request_id\}/);

console.log('Patient request status, phone sharing and controlled chat checks passed.');
