import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_CONTACT_ACCESS_ALLOWED_FIELDS,
  PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION,
  buildApprovedProviderContact,
  normalizeApprovedContactFields,
  providerContactAccessEligibility,
  sanitizeProviderContactAccessStatus,
} from '../shared/providerContactAccessPolicy.js';

assert.equal(PROVIDER_CONTACT_ACCESS_CONTRACT_VERSION, 'provider-phone-access-v2');
assert.deepEqual(PROVIDER_CONTACT_ACCESS_ALLOWED_FIELDS, ['contact_phone']);
assert.deepEqual(normalizeApprovedContactFields([
  'contact_name',
  'contact_phone',
  'contact_email',
  'contact_phone',
]), ['contact_phone']);

const lead = {
  id: 'lead-1',
  request_id: 'request-1',
  location_id: 'location-1',
  delivery_state: 'available',
  status: 'interested',
};
const response = {
  lead_id: 'lead-1',
  location_id: 'location-1',
  status: 'active',
  response_type: 'can_help',
};
const approval = {
  lead_id: 'lead-1',
  location_id: 'location-1',
  status: 'approved',
  allowed_contact_fields: ['contact_phone'],
};
const contact = {
  status: 'active',
  contact_email_verified: false,
  contact_name: 'Client Test',
  contact_email: 'client@example.com',
  contact_phone: '0712345678',
  contact_preference: 'phone',
  access_token_hash: 'secret',
};

const eligible = providerContactAccessEligibility({ lead, response, approval, contact });
assert.equal(eligible.eligible, true);
assert.deepEqual(eligible.approved_fields, ['contact_phone']);

const missingPhone = providerContactAccessEligibility({
  lead,
  response,
  approval,
  contact: { ...contact, contact_phone: '' },
});
assert.equal(missingPhone.eligible, false);
assert.ok(missingPhone.reasons.includes('patient_phone_not_available'));

const declined = providerContactAccessEligibility({
  lead: { ...lead, status: 'declined' },
  response: { ...response, response_type: 'cannot_help' },
  approval,
  contact,
});
assert.equal(declined.eligible, false);
assert.ok(declined.reasons.includes('lead_status_not_eligible'));
assert.ok(declined.reasons.includes('provider_response_not_eligible'));

const wrongApproval = providerContactAccessEligibility({
  lead,
  response,
  approval: { ...approval, location_id: 'location-2' },
  contact,
});
assert.equal(wrongApproval.eligible, false);
assert.ok(wrongApproval.reasons.includes('approval_location_mismatch'));

const safeContact = buildApprovedProviderContact(contact, [
  'contact_name',
  'contact_email',
  'contact_phone',
  'access_token_hash',
]);
assert.deepEqual(safeContact, { contact_phone: '0712345678' });

assert.deepEqual(sanitizeProviderContactAccessStatus({
  eligible: true,
  approvedFields: ['contact_phone', 'contact_email'],
}), {
  available: true,
  state: 'patient_approved',
  approved_fields: ['contact_phone'],
  reason: '',
});
assert.equal(sanitizeProviderContactAccessStatus({
  eligible: false,
  reasons: ['patient_approval_missing'],
  approvedFields: ['contact_phone'],
}).available, false);

const auditSchema = JSON.parse(await readFile(new URL('../base44/entities/ProviderLeadContactAccessAudit.jsonc', import.meta.url), 'utf8'));
assert.equal(auditSchema.rls.read.user_condition.role, 'admin');
assert.deepEqual(auditSchema.properties.outcome.enum, ['granted', 'denied']);
for (const forbidden of [
  'contact_name',
  'contact_email',
  'contact_phone',
  'contact_preference',
  'original_message',
  'detailed_message',
]) {
  assert.equal(auditSchema.properties[forbidden], undefined, `${forbidden} nu trebuie stocat in audit`);
}

const backend = await readFile(new URL('../base44/functions/providerLeadContactAccessOps/entry.ts', import.meta.url), 'utf8');
assert.match(backend, /base44\.auth\.me\(\)/);
assert.match(backend, /ProviderMembership\.filter/);
assert.match(backend, /ProviderSubscription\.filter/);
assert.match(backend, /hasProviderFeature\(entitlement, 'provider_contact\.access_after_consent'\)/);
assert.match(backend, /ProviderLeadResponse\.filter/);
assert.match(backend, /ContactShareApproval\.filter/);
assert.match(backend, /PatientRequestContact\.filter/);
assert.match(backend, /providerContactAccessEligibility/);
assert.match(backend, /ProviderLeadContactAccessAudit\.create/);
assert.match(backend, /conversation_enabled: false/);
assert.match(backend, /action === 'status'/);
assert.match(backend, /action !== 'read'/);
assert.doesNotMatch(backend, /input\.plan_code|input\.entitlement|input\.approved_fields/);
assert.doesNotMatch(backend, /PatientRequest\.get|PatientRequestAnswer/);
assert.doesNotMatch(backend, /original_message|detailed_message|access_token_hash/);
assert.doesNotMatch(backend, /contact_name:|contact_email:/);

console.log('Provider approved phone access checks passed.');
