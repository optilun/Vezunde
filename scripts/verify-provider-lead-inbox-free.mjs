import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_LEAD_INBOX_CONTRACT_VERSION,
  canAccessProviderLeadInbox,
  filterProviderLeadInbox,
  providerLeadIsHistorical,
  sanitizeProviderLeadForFreeInbox,
  summarizeProviderLeadInbox,
} from '../shared/providerLeadInboxPolicy.js';
import {
  buildProviderLeadFullDetails,
  providerLeadFullDetailsEligibility,
} from '../shared/providerLeadFullDetailsPolicy.js';

assert.equal(PROVIDER_LEAD_INBOX_CONTRACT_VERSION, 'provider-lead-inbox-v2');
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
assert.equal(safe.is_historical, false);
for (const forbidden of ['request_id', 'contact_name', 'contact_email', 'contact_phone', 'original_message', 'detailed_message', 'full_details']) {
  assert.equal(Object.hasOwn(safe, forbidden), false, `${forbidden} nu trebuie returnat in inboxul Free`);
}
assert.equal(safe.conversation_access_state, 'locked');

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

// --- Contract full-details v2: mesajul de deschidere (2026-09-01) ---------------------
// Acordul v2 de mai sus ramane valid pentru distribuire, dar textul lui nu enumera mesajul
// cu care pacientul a pornit cautarea, deci acel camp NU se livreaza retroactiv.
const openingRequest = {
  persistence_state: 'complete',
  original_message: 'nu vad bine la distanta de vreo doua luni',
  detailed_message: 'Am nevoie de reparatie la balama.',
};
assert.equal(buildProviderLeadFullDetails({ request: openingRequest, contact }).original_message, '');

// Acordul v3 il autorizeaza.
const contactV3 = {
  ...contact,
  provider_request_distribution_consent_version: 'patient-request-distribution-top3-pro-v3',
};
assert.equal(
  providerLeadFullDetailsEligibility({ lead: rawLead, request: openingRequest, contact: contactV3, entitlement }).eligible,
  true,
);
assert.equal(
  buildProviderLeadFullDetails({ request: openingRequest, contact: contactV3 }).original_message,
  openingRequest.original_message,
);

// Caseta din hero e un camp de cautare, fara avertizare ca textul ajunge la furnizor.
// Datele de contact scrise acolo se redacteaza la fel ca in chatul controlat, altfel
// promisiunea "telefonul ramane ascuns pana il aprobi tu" ar fi ocolita pe canalul asta.
const leakyDetails = buildProviderLeadFullDetails({
  request: { ...openingRequest, original_message: 'sunt Ion, 0745 123 456, ana@example.com' },
  contact: contactV3,
});
assert.doesNotMatch(leakyDetails.original_message, /0745/);
assert.doesNotMatch(leakyDetails.original_message, /ana@example\.com/);

// Nu il repetam daca pacientul a scris acelasi lucru in ambele campuri. Comparatia se face
// pe textele brute: altfel doua mesaje identice care contin un telefon ar scapa de
// deduplicare (unul redactat, unul nu) si furnizorul le-ar vedea pe amandoua.
assert.equal(
  buildProviderLeadFullDetails({
    request: { persistence_state: 'complete', original_message: 'acelasi text', detailed_message: 'acelasi text' },
    contact: contactV3,
  }).original_message,
  '',
);
const duplicatedWithPhone = 'sunt Ion, 0745 123 456, imi trebuie ochelari';
assert.equal(
  buildProviderLeadFullDetails({
    request: { persistence_state: 'complete', original_message: duplicatedWithPhone, detailed_message: duplicatedWithPhone },
    contact: contactV3,
  }).original_message,
  '',
);

// Mesajul final poate lipsi acum: e suficient ca cererea sa aiba un text liber. Inainte,
// un detailed_message gol facea lead-ul inelegibil, deci furnizorul pierdea si numele si
// emailul - doar pentru ca pacientul nu si-a descris nevoia a treia oara.
const onlyOpeningRequest = { persistence_state: 'complete', original_message: 'nu vad bine la distanta' };
assert.equal(
  providerLeadFullDetailsEligibility({ lead: rawLead, request: onlyOpeningRequest, contact: contactV3, entitlement }).eligible,
  true,
);
const onlyOpeningDetails = buildProviderLeadFullDetails({ request: onlyOpeningRequest, contact: contactV3 });
assert.equal(onlyOpeningDetails.detailed_message, '');
assert.equal(onlyOpeningDetails.original_message, onlyOpeningRequest.original_message);

// Fara niciun text liber, lead-ul ramane inelegibil.
const emptyRequestEligibility = providerLeadFullDetailsEligibility({
  lead: rawLead,
  request: { persistence_state: 'complete' },
  contact: contactV3,
  entitlement,
});
assert.equal(emptyRequestEligibility.eligible, false);
assert.ok(emptyRequestEligibility.reasons.includes('detailed_message_missing'));

// Un acord cu versiune necunoscuta ramane respins.
assert.ok(providerLeadFullDetailsEligibility({
  lead: rawLead,
  request: openingRequest,
  contact: { ...contact, provider_request_distribution_consent_version: 'patient-request-distribution-top3-pro-v1' },
  entitlement,
}).reasons.includes('distribution_consent_version_not_supported'));

const freeEligibility = providerLeadFullDetailsEligibility({ lead: rawLead, request, contact, entitlement: { plan_code: 'free', feature_keys: [] } });
assert.equal(freeEligibility.eligible, false);
assert.ok(freeEligibility.reasons.includes('pro_full_details_required'));
const extendedEligibility = providerLeadFullDetailsEligibility({ lead: { ...rawLead, access_tier: 'free_preview', result_bucket_snapshot: 'extended_confirmed' }, request, contact, entitlement });
assert.equal(extendedEligibility.eligible, false);
assert.ok(extendedEligibility.reasons.includes('lead_not_top3'));

const historicalLead = {
  ...rawLead,
  id: 'lead-history',
  delivery_state: 'withdrawn',
  status: 'closed',
  closure_reason: 'request_resolved',
  closed_at: '2026-07-20T12:00:00.000Z',
};
assert.equal(providerLeadIsHistorical(historicalLead), true);
assert.equal(filterProviderLeadInbox([rawLead, historicalLead], { scope: 'active' })[0].id, 'lead-1');
assert.equal(filterProviderLeadInbox([rawLead, historicalLead], { scope: 'history' })[0].id, 'lead-history');
const counters = summarizeProviderLeadInbox([rawLead, { ...rawLead, id: 'lead-viewed', status: 'viewed' }, historicalLead]);
assert.deepEqual(counters, {
  total: 3,
  available: 2,
  history: 1,
  new: 1,
  viewed: 1,
  active: 2,
  closed: 1,
  expired: 0,
});

const backend = await readFile(new URL('../base44/functions/providerLeadInboxOps/entry.ts', import.meta.url), 'utf8');
const component = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInbox.jsx', import.meta.url), 'utf8');
const chatComponent = await readFile(new URL('../src/components/workspace/provider/ProviderLeadChat.jsx', import.meta.url), 'utf8');
assert.match(backend, /resolveProviderEntitlement/);
assert.match(backend, /providerLeadFullDetailsEligibility/);
assert.match(backend, /filterProviderLeadInbox/);
assert.match(backend, /ProviderLeadContactAccessAudit\.create/);
assert.match(backend, /PatientRequestContact\.filter/);
assert.match(backend, /access_contract_version: PROVIDER_LEAD_FULL_DETAILS_CONTRACT_VERSION/);
assert.doesNotMatch(backend, /contact_phone:/);
assert.match(component, /Detalii Pro · Top 3/);
assert.match(component, /Încheiate/);
assert.match(component, /is_historical/);
assert.match(component, /Telefonul rămâne separat/);
assert.match(component, /phone_available_for_request/);
assert.match(component, /provider_chat\.access/);
assert.match(component, /terminal=\{terminal\}/);
assert.doesNotMatch(component, /base44\.entities\.ProviderLead/);
assert.match(chatComponent, /Istoric chat VIASEE · Pro/);
assert.match(chatComponent, /Istoricul rămâne numai pentru consultare/);
assert.match(chatComponent, /Locația nu poate iniția chatul unilateral/);
assert.doesNotMatch(chatComponent, /base44\.entities\.PatientRequestMessage|base44\.entities\.PatientRequestConversation/);

console.log('Provider inbox active/history isolation and Top 3 Pro controlled access checks passed.');
