import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PROVIDER_LEAD_RESPONSE_CONTRACT_VERSION,
  normalizeProviderLeadResponseType,
  providerLeadResponseLabel,
  providerLeadStatusForResponse,
  sanitizeProviderLeadResponse,
} from '../shared/providerLeadResponsePolicy.js';
import {
  acquireProviderLeadResponseLock,
  releaseProviderLeadResponseLock,
} from '../shared/providerLeadResponseLock.js';

assert.equal(PROVIDER_LEAD_RESPONSE_CONTRACT_VERSION, 'provider-lead-response-v1');
assert.equal(normalizeProviderLeadResponseType('can_help'), 'can_help');
assert.equal(normalizeProviderLeadResponseType('needs_details'), 'needs_details');
assert.equal(normalizeProviderLeadResponseType('cannot_help'), 'cannot_help');
assert.equal(normalizeProviderLeadResponseType('custom_message'), '');
assert.equal(providerLeadStatusForResponse('can_help'), 'interested');
assert.equal(providerLeadStatusForResponse('needs_details'), 'needs_details');
assert.equal(providerLeadStatusForResponse('cannot_help'), 'declined');
assert.equal(providerLeadResponseLabel('can_help'), 'Putem ajuta');

const safe = sanitizeProviderLeadResponse({
  id: 'response-1',
  lead_id: 'lead-1',
  request_id: 'request-secret',
  location_id: 'location-1',
  responder_user_id: 'user-secret',
  response_type: 'can_help',
  status: 'active',
  submitted_at: '2026-07-19T12:00:00.000Z',
  contact_email: 'secret@example.com',
});
assert.equal(safe.response_type, 'can_help');
assert.equal(safe.response_label, 'Putem ajuta');
for (const forbidden of ['request_id', 'responder_user_id', 'contact_email', 'contact_phone', 'message', 'original_message']) {
  assert.equal(Object.hasOwn(safe, forbidden), false, `${forbidden} nu trebuie returnat furnizorului`);
}

let lockToken = '';
const mockSvc = {
  entities: {
    ProviderLead: {
      async updateMany(query, update) {
        if (update.$set) {
          if (lockToken) return { updated: 0 };
          lockToken = update.$set.response_lock_token;
          return { updated: 1 };
        }
        if (update.$unset && query.response_lock_token === lockToken) {
          lockToken = '';
          return { updated: 1 };
        }
        return { updated: 0 };
      },
    },
  },
};
const [firstLock, secondLock] = await Promise.all([
  acquireProviderLeadResponseLock(mockSvc, 'lead-1'),
  acquireProviderLeadResponseLock(mockSvc, 'lead-1'),
]);
assert.equal([firstLock, secondLock].filter(Boolean).length, 1);
assert.equal(await releaseProviderLeadResponseLock(mockSvc, firstLock || secondLock), true);

const responseSchema = JSON.parse(await readFile(new URL('../base44/entities/ProviderLeadResponse.jsonc', import.meta.url), 'utf8'));
const leadSchema = JSON.parse(await readFile(new URL('../base44/entities/ProviderLead.jsonc', import.meta.url), 'utf8'));
assert.equal(responseSchema.rls.read.user_condition.role, 'admin');
assert.deepEqual(responseSchema.properties.response_type.enum, ['can_help', 'needs_details', 'cannot_help']);
for (const forbidden of ['message', 'contact_name', 'contact_email', 'contact_phone', 'original_message', 'detailed_message']) {
  assert.equal(responseSchema.properties[forbidden], undefined, `${forbidden} nu trebuie stocat in raspunsul structurat`);
}
assert.ok(leadSchema.properties.response_lock_token);
assert.ok(leadSchema.properties.response_lock_at);
assert.ok(leadSchema.properties.last_response_at);
assert.ok(leadSchema.properties.conversation_lock_token);

const backend = await readFile(new URL('../base44/functions/providerLeadResponseOps/entry.ts', import.meta.url), 'utf8');
// Redesign pe doua coloane (2026-08-18): componenta ProviderLeadInboxLegacy.jsx mai
// orchestreaza doar cererea de raspuns; textul de siguranta si <ProviderLeadChat> s-au
// mutat in leads/LeadDetailPanel.jsx, iar eticheta Top 3 in leads/LeadFullDetails.jsx.
const component = await readFile(new URL('../src/components/workspace/provider/ProviderLeadInboxLegacy.jsx', import.meta.url), 'utf8');
const detailPanel = await readFile(new URL('../src/components/workspace/provider/leads/LeadDetailPanel.jsx', import.meta.url), 'utf8');
const fullDetails = await readFile(new URL('../src/components/workspace/provider/leads/LeadFullDetails.jsx', import.meta.url), 'utf8');
const chatComponent = await readFile(new URL('../src/components/workspace/provider/ProviderLeadChat.jsx', import.meta.url), 'utf8');
assert.match(backend, /base44\.auth\.me\(\)/);
assert.match(backend, /ProviderMembership\.filter/);
assert.match(backend, /ProviderSubscription\.filter/);
assert.match(backend, /hasProviderFeature\(entitlement, 'provider_leads\.respond'\)/);
assert.match(backend, /acquireProviderLeadResponseLock/);
assert.match(backend, /releaseProviderLeadResponseLock/);
assert.match(backend, /ProviderLeadResponse\.create/);
assert.match(backend, /responseType === 'cannot_help'/);
assert.match(backend, /contact_access_state: 'revoked'/);
assert.match(backend, /PatientRequestConversation\.filter/);
assert.match(backend, /closed_by: 'system'/);
assert.match(backend, /conversation_access_state: 'locked'/);
assert.doesNotMatch(backend, /input\.plan_code/);
assert.doesNotMatch(backend, /input\.(message|contact_email|contact_phone|original_message|detailed_message)/);
assert.doesNotMatch(backend, /PatientRequestContact/);

assert.match(component, /providerLeadResponseOps/);
assert.match(component, /provider_leads\.respond/);
assert.match(component, /response_type: responseType/);
assert.doesNotMatch(component, /<textarea|contentEditable/);
assert.doesNotMatch(component, /contact_phone\s*:|original_message|PatientRequestContact/);

assert.match(detailPanel, /Telefonul rămâne separat/);
assert.match(detailPanel, /nu deschide unilateral chatul/);
assert.match(detailPanel, /<ProviderLeadChat/);
assert.doesNotMatch(detailPanel, /<textarea|contentEditable/);
assert.doesNotMatch(detailPanel, /contact_phone\s*:|original_message|PatientRequestContact/);

assert.match(fullDetails, /Detalii Pro · Top 3/);
assert.match(chatComponent, /<textarea/);
assert.match(chatComponent, /Locația nu poate iniția chatul unilateral/);
assert.match(chatComponent, /controlledChatOps/);

console.log('Provider lead response and controlled chat transition checks passed.');
