import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CONTACT_SHARE_ALLOWED_FIELDS,
  CONTACT_SHARE_APPROVAL_CONTRACT_VERSION,
  canApproveContactShareForResponse,
  sanitizeContactShareApproval,
} from '../shared/contactShareApprovalPolicy.js';
import {
  acquireContactShareApprovalLock,
  releaseContactShareApprovalLock,
} from '../shared/contactShareApprovalLock.js';

assert.equal(CONTACT_SHARE_APPROVAL_CONTRACT_VERSION, 'patient-contact-share-v1');
assert.deepEqual(CONTACT_SHARE_ALLOWED_FIELDS, [
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_preference',
]);
assert.equal(canApproveContactShareForResponse({ status: 'active', response_type: 'can_help' }), true);
assert.equal(canApproveContactShareForResponse({ status: 'active', response_type: 'needs_details' }), true);
assert.equal(canApproveContactShareForResponse({ status: 'active', response_type: 'cannot_help' }), false);
assert.equal(canApproveContactShareForResponse({ status: 'withdrawn', response_type: 'can_help' }), false);

const safe = sanitizeContactShareApproval({
  id: 'approval-secret',
  request_id: 'request-secret',
  lead_id: 'lead-secret',
  provider_response_id: 'response-secret',
  organization_id: 'org-secret',
  location_id: 'location-1',
  status: 'approved',
  approved_at: '2026-07-19T12:00:00.000Z',
  allowed_contact_fields: CONTACT_SHARE_ALLOWED_FIELDS,
});
assert.equal(safe.location_id, 'location-1');
assert.equal(safe.status, 'approved');
for (const forbidden of ['id', 'request_id', 'lead_id', 'provider_response_id', 'organization_id']) {
  assert.equal(Object.hasOwn(safe, forbidden), false, `${forbidden} nu trebuie returnat clientului`);
}

let lockToken = '';
const mockSvc = {
  entities: {
    ProviderLead: {
      async updateMany(query, update) {
        if (update.$set) {
          if (lockToken) return { updated: 0 };
          lockToken = update.$set.contact_approval_lock_token;
          return { updated: 1 };
        }
        if (update.$unset && query.contact_approval_lock_token === lockToken) {
          lockToken = '';
          return { updated: 1 };
        }
        return { updated: 0 };
      },
    },
  },
};
const [firstLock, secondLock] = await Promise.all([
  acquireContactShareApprovalLock(mockSvc, 'lead-1'),
  acquireContactShareApprovalLock(mockSvc, 'lead-1'),
]);
assert.equal([firstLock, secondLock].filter(Boolean).length, 1);
assert.equal(await releaseContactShareApprovalLock(mockSvc, firstLock || secondLock), true);

const approvalSchema = JSON.parse(await readFile(new URL('../base44/entities/ContactShareApproval.jsonc', import.meta.url), 'utf8'));
const leadSchema = JSON.parse(await readFile(new URL('../base44/entities/ProviderLead.jsonc', import.meta.url), 'utf8'));
assert.equal(approvalSchema.rls.read.user_condition.role, 'admin');
assert.deepEqual(approvalSchema.properties.status.enum, ['approved', 'revoked']);
for (const forbidden of ['contact_name', 'contact_email', 'contact_phone', 'contact_preference', 'original_message']) {
  assert.equal(approvalSchema.properties[forbidden], undefined, `${forbidden} nu trebuie stocat in aprobare`);
}
assert.ok(leadSchema.properties.contact_approval_lock_token);
assert.ok(leadSchema.properties.contact_approval_lock_at);
assert.ok(leadSchema.properties.last_contact_approval_at);

const backend = await readFile(new URL('../base44/functions/managePatientContactShareApproval/entry.ts', import.meta.url), 'utf8');
const statusBackend = await readFile(new URL('../base44/functions/getPatientRequestStatus/entry.ts', import.meta.url), 'utf8');
const client = await readFile(new URL('../src/lib/patientRequestPersistenceClient.js', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/intake2/PatientRequestResponseStatus.jsx', import.meta.url), 'utf8');

assert.match(backend, /sha256\(accessToken\)/);
assert.match(backend, /PatientRequestContact\.filter/);
assert.match(backend, /access_token_hash: tokenHash/);
assert.match(backend, /ProviderLeadResponse\.filter/);
assert.match(backend, /canApproveContactShareForResponse/);
assert.match(backend, /ContactShareApproval\.filter/);
assert.match(backend, /ContactShareApproval\.create/);
assert.match(backend, /ContactShareApproval\.update/);
assert.match(backend, /contact_access_state: 'patient_approved'/);
assert.match(backend, /contact_access_state: 'revoked'/);
assert.match(backend, /conversation_access_state: 'locked'/);
assert.match(backend, /acquireContactShareApprovalLock/);
assert.match(backend, /releaseContactShareApprovalLock/);
assert.doesNotMatch(backend, /base44\.auth\.me\(\)/);
assert.doesNotMatch(backend, /PatientRequestContact\.update/);
assert.doesNotMatch(backend, /provider_contact_sharing_consent/);
assert.doesNotMatch(backend, /contact_email:|contact_phone:|contact_name:|original_message:/);
assert.doesNotMatch(backend, /ProviderSubscription|hasProviderFeature/);

assert.match(statusBackend, /ContactShareApproval\.filter/);
assert.match(statusBackend, /contact_share_status === 'approved'/);
assert.doesNotMatch(statusBackend, /contact_email:|contact_phone:|contact_name:|original_message:/);
assert.match(client, /managePatientContactShareApproval/);
assert.match(client, /managePatientContactShareApproval/);
assert.match(component, /Permit acestei locații accesul la contact/);
assert.match(component, /Retrage accesul la contact/);
assert.match(component, /Doar această locație/);
assert.match(component, /Conversația rămâne blocată/);
assert.doesNotMatch(component, /contact_email|contact_phone|PatientRequestContact/);

console.log('Per-location contact share approval checks passed.');
