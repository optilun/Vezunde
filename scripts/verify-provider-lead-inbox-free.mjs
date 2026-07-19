import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
  canAccessProviderLeadInbox,
  sanitizeProviderLeadForFreeInbox,
  summarizeProviderLeadInbox,
} from '../shared/providerLeadInboxPolicy.js';
import {
  buildProviderLeadFullDetails,
  providerLeadFullDetailsEligibility,
} from '../shared/providerLeadFullDetailsPolicy.js';

assert.equal(PROVIDER_LEAD_INBOX_CONTRACT_VERSION, 'provider-lead-inbox-free-v1');
assert.equal(canAccessProviderLeadInbox('organization_owner'), true);
assert.equal(canAccessProviderLeadInbox('location_manager'), true);
assert.equal(canAccessProviderLeadInbox('location_staff'), true);
assert.equal(canAccessProviderLeadInbox('patient'), false);

const rawLead = {
  id: 'lead-1',
  request_id: 'request-secret',
  location_id: 'location-1',
  intent: 'reparatii_ochelari',
  intent_label: 'Reparatii sau reglaje',
  service_keys: ['eyeglasses_repair'],
  matched_service_keys: ['eyeglasses_repair'],
  city: 'Timisoara',
  county: 'Timis',
  preview_summary: 'Reparatie · Timisoara',
  access_tier: 'pro_full',
  result_bucket_snapshot: 'top3',
  delivery_state: 'available',
  status: 'new',
};
const safe = sanitizeProviderLeadForFreeInbox(rawLead);
assert.equal(safe.access_tier, 'free_preview');
for (const forbidden of ['request_id', 'contact_name', 'contact_email', 'contact_phone', 'original_message', 'detailed_message', 'full_details']) {
  assert.equal(Object.hasOwn(safe, forbidden), false, `${forbidden} nu trebuie returnat in inboxul Free`);
}

const entitlement = { plan_code: 'pro', feature_keys: ['provider_leads.full_details'] };
const request = { persistence_state: 'complete', detailed_message: 'Am nevoie de reparatie la balama.' };
const contact = {
  status: 'active',
  contact_name: 'Ana Popescu',
  contact_email: 'ana@example.com',
  contact_email_verified: true,
  contact_phone: '0722123456',
  provider_request_distribution_consent: true,
  provider_request_distribution_consent_version: 'patient-request-distribution-top3-pro-v2',
};
const eligibility = providerLeadFullDetailsEligibility({ lead: rawLead, request, contact, entitlement });
assert.equal(eligibility.eligible, true);
const full = buildProviderLeadFullDetails({ request, contact });
assert.equal(full.client_name, 'Ana Popescu');
assert.equal(full.client_email, 'ana@example.com');
assert.equal(full.detailed_message, request.detailed_message);
assert.equal(full.phone_available_for_request, true);
assert.equal(Object.hasOwn(full, 'contact_phone'), false);

const freeEligibility = providerLeadFullDetailsEligibility({ lead: rawLead, request, contact, entitlement: { plan_code: 'free', feature_keys: [] } });
assert.equal(freeEligibility.eligible, false);
assert.ok(freeEligibility.reasons.includes('pro_full_details_required'));
const extendedEligibility = providerLeadFullDetailsEligibility({ lead: { ...rawLead, access_tier: 'free_preview', result_bucket_snapshot: 'extended_confirmed' }, request, contact, entitlement });
assert.equal(extendedEligibility.eligible, false);
assert.ok(extendedEligibility.reasons.includes('lead_not_top3'));

assert.deepEqual(summarizeProviderLeadInbox([{ status: 'new' }, { status: 'viewed' }, { status: 'closed' }]), { total: 3, new: 1, viewed: 1, active: 2 });

const backend = await readFile(new URL('../base44/functions/providerLeadInboxOps/entry.ts', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');
assert.match(backend, /resolveProviderEntitlement/);
assert.match(backend, /providerLeadFullDetailsEligibility/);
assert.match(backend, /ProviderLeadContactAccessAudit\.create/);
assert.match(backend, /PatientRequestContact\.filter/);
assert.match(backend, /access_contract_version: PROVIDER_LEAD_FULL_DETAILS_CONTRACT_VERSION/);
assert.doesNotMatch(backend, /contact_phone:/);
assert.match(component, /Detalii Pro · Top 3/);
assert.match(component, /Telefonul rămâne ascuns/);
assert.match(component, /phone_available_for_request/);
assert.doesNotMatch(component, /base44\.entities\.ProviderLead/);

console.log('Provider inbox Free isolation and Top 3 Pro detail checks passed.');
