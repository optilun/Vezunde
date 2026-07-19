import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
  canAccessProviderLeadInbox,
  sanitizeProviderLeadForFreeInbox,
  summarizeProviderLeadInbox,
} from '../shared/providerLeadInboxPolicy.js';

assert.equal(PROVIDER_LEAD_INBOX_CONTRACT_VERSION, 'provider-lead-inbox-free-v1');
assert.equal(canAccessProviderLeadInbox('organization_owner'), true);
assert.equal(canAccessProviderLeadInbox('location_manager'), true);
assert.equal(canAccessProviderLeadInbox('location_staff'), true);
assert.equal(canAccessProviderLeadInbox('patient'), false);
assert.equal(canAccessProviderLeadInbox(''), false);

const safe = sanitizeProviderLeadForFreeInbox({
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
  contact_access_state: 'patient_approved',
  conversation_access_state: 'available',
  contact_name: 'Secret',
  contact_email: 'secret@example.com',
  contact_phone: '0700000000',
  original_message: 'Mesaj privat',
  status: 'new',
});
assert.equal(safe.id, 'lead-1');
assert.equal(safe.access_tier, 'free_preview');
assert.equal(safe.contact_access_state, 'hidden');
assert.equal(safe.conversation_access_state, 'locked');
for (const forbidden of ['request_id', 'contact_name', 'contact_email', 'contact_phone', 'original_message']) {
  assert.equal(Object.hasOwn(safe, forbidden), false, `${forbidden} nu trebuie returnat in inboxul Free`);
}
assert.deepEqual(summarizeProviderLeadInbox([
  { status: 'new' },
  { status: 'viewed' },
  { status: 'closed' },
]), { total: 3, new: 1, viewed: 1, active: 2 });

const backend = await readFile(new URL('../base44/functions/providerLeadInboxOps/entry.ts', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');
const root = await readFile(new URL('../src/components/workspace/provider/ProviderWorkspaceRoot.jsx', import.meta.url), 'utf8');
const nav = await readFile(new URL('../src/lib/workspaceNav.js', import.meta.url), 'utf8');

assert.match(backend, /base44\.auth\.me\(\)/);
assert.match(backend, /ProviderMembership\.filter/);
assert.match(backend, /user_id: user\.id/);
assert.match(backend, /location_id: locationId/);
assert.match(backend, /status: 'active'/);
assert.match(backend, /canAccessProviderLeadInbox/);
assert.match(backend, /ProviderLead\.filter/);
assert.match(backend, /sanitizeProviderLeadForFreeInbox/);
assert.match(backend, /action === 'mark_viewed'/);
assert.match(backend, /\{ status: 'viewed' \}/);
assert.doesNotMatch(backend, /PatientRequestContact/);
assert.doesNotMatch(backend, /PatientRequest\.get/);

assert.match(component, /providerLeadInboxOps/);
assert.match(component, /action: "list"/);
assert.match(component, /action: "mark_viewed"/);
assert.match(component, /Contactul și conversația sunt blocate/);
assert.doesNotMatch(component, /base44\.entities\.ProviderLead/);
assert.doesNotMatch(component, /contact_email|contact_phone|original_message|PatientRequestContact/);

assert.match(root, /location\.manage_requests/);
assert.match(root, /safeSection === "leads"/);
assert.match(root, /ProviderLeadInbox/);
assert.match(nav, /canManageRequests/);
assert.match(nav, /key: "leads"/);

console.log('Provider free lead inbox checks passed.');
