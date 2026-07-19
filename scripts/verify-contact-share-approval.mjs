import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CONTACT_SHARE_ALLOWED_FIELDS,
  CONTACT_SHARE_APPROVAL_CONTRACT_VERSION,
  canApproveContactShareForResponse,
  sanitizeContactShareApproval,
} from '../shared/contactShareApprovalPolicy.js';
import {
  PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION,
  buildApprovedProviderContact,
  providerContactAccessEligibility,
} from '../shared/providerContactAccessPolicy.js';

assert.equal(CONTACT_SHARE_APPROVAL_CONTRACT_VERSION, 'patient-phone-share-v2');
assert.deepEqual(CONTACT_SHARE_ALLOWED_FIELDS, ['contact_phone']);
assert.equal(PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION, 'provider-phone-access-v2');
assert.equal(canApproveContactShareForResponse({ status: 'active', response_type: 'can_help' }), true);
assert.equal(canApproveContactShareForResponse({ status: 'active', response_type: 'needs_details' }), true);
assert.equal(canApproveContactShareForResponse({ status: 'active', response_type: 'cannot_help' }), false);

const safe = sanitizeContactShareApproval({ location_id: 'location-1', status: 'approved', allowed_contact_fields: ['contact_phone'] });
assert.equal(safe.status, 'approved');
assert.deepEqual(safe.allowed_contact_fields, ['contact_phone']);

const eligibility = providerContactAccessEligibility({
  lead: { id: 'lead-1', location_id: 'location-1', delivery_state: 'available', status: 'interested' },
  response: { status: 'active', response_type: 'can_help' },
  approval: { status: 'approved', lead_id: 'lead-1', location_id: 'location-1', allowed_contact_fields: ['contact_phone'] },
  contact: { status: 'active', contact_phone: '0722123456', contact_name: 'Ana', contact_email: 'ana@example.com' },
});
assert.equal(eligibility.eligible, true);
assert.deepEqual(buildApprovedProviderContact({ contact_phone: '0722123456', contact_name: 'Ana', contact_email: 'ana@example.com' }, eligibility.approved_fields), { contact_phone: '0722123456' });

const approvalSchema = JSON.parse(await readFile(new URL('../base44/entities/ContactShareApproval.jsonc', import.meta.url), 'utf8'));
assert.equal(approvalSchema.rls.read.user_condition.role, 'admin');
for (const forbidden of ['contact_name', 'contact_email', 'contact_phone', 'contact_preference', 'original_message']) {
  assert.equal(approvalSchema.properties[forbidden], undefined, `${forbidden} nu trebuie stocat in aprobare`);
}

const backend = await readFile(new URL('../base44/functions/managePatientContactShareApproval/entry.ts', import.meta.url), 'utf8');
const accessBackend = await readFile(new URL('../base44/functions/providerLeadContactAccessOps/entry.ts', import.meta.url), 'utf8');
const statusBackend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const patientComponent = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');
const providerComponent = await readFile(new URL('../src/components/workspace/provider/ProviderLeadContactAccess.jsx', import.meta.url), 'utf8');

assert.match(backend, /CONTACT_SHARE_ALLOWED_FIELDS/);
assert.match(backend, /contact_phone_available/);
assert.doesNotMatch(backend, /contact_email_verified !== true/);
assert.match(accessBackend, /buildApprovedProviderContact/);
assert.match(statusBackend, /contact_phone_available/);
assert.match(patientComponent, /Permite acestei locații accesul la telefon/);
assert.match(patientComponent, /Retrage accesul la telefon/);
assert.match(providerComponent, /Afișează telefonul/);
assert.doesNotMatch(providerComponent, /contact_name|contact_email|contact_preference/);

console.log('Per-location phone sharing checks passed.');
