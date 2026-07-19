import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  COMMUNICATION_EVENT_CATALOG_VERSION,
  COMMUNICATION_EVENT_KEYS,
  buildPatientProviderResponseEmail,
  buildProviderLeadAvailableEmail,
  canReceiveProviderLeadEmail,
  communicationEventDefinition,
} from '../shared/communicationEventCatalog.js';
import {
  communicationDeliveryIdempotencyKey,
  deliverCommunicationEmail,
} from '../shared/communicationDelivery.js';

assert.equal(COMMUNICATION_EVENT_CATALOG_VERSION, 'communication-events-v1');
assert.equal(communicationEventDefinition(COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE)?.template_version, 'provider-lead-available-v1');
assert.equal(communicationEventDefinition(COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED)?.template_version, 'patient-provider-response-v1');
assert.equal(communicationEventDefinition('unknown'), null);
assert.equal(canReceiveProviderLeadEmail('organization_owner'), true);
assert.equal(canReceiveProviderLeadEmail('location_manager'), true);
assert.equal(canReceiveProviderLeadEmail('location_staff'), false);

const providerEmail = buildProviderLeadAvailableEmail({
  locationName: 'Optica Test',
  city: 'Timisoara',
  intentLabel: 'Reparatii sau reglaje',
});
assert.match(providerEmail.subject, /Optica Test/);
assert.match(providerEmail.body, /Datele de contact ale clientului nu sunt incluse/);
assert.doesNotMatch(providerEmail.body, /client@example\.com|0712345678|Mesaj privat/);

const patientEmail = buildPatientProviderResponseEmail({
  publicReference: 'VS-TEST',
  locationName: 'Optica Test',
  responseType: 'can_help',
});
assert.match(patientEmail.subject, /VS-TEST/);
assert.match(patientEmail.body, /Optica Test poate ajuta/);
assert.match(patientEmail.body, /acord separat pentru fiecare locatie/);
assert.doesNotMatch(patientEmail.body, /contact_name|contact_email|contact_phone|original_message/);

assert.equal(
  communicationDeliveryIdempotencyKey({
    eventKey: 'provider_lead_available',
    sourceId: 'lead-1',
    recipientRefId: 'user-1',
  }),
  'provider_lead_available:lead-1:user-1:',
);

const rows = [];
const sentEmails = [];
const svc = {
  entities: {
    CommunicationDelivery: {
      async filter(query) {
        return rows.filter((row) => row.idempotency_key === query.idempotency_key);
      },
      async create(payload) {
        const row = { id: `delivery-${rows.length + 1}`, created_date: new Date().toISOString(), ...payload };
        rows.push(row);
        return row;
      },
      async update(id, payload) {
        const row = rows.find((item) => item.id === id);
        Object.assign(row, payload);
        return row;
      },
    },
  },
};
const base44 = {
  integrations: {
    Core: {
      async SendEmail(payload) {
        sentEmails.push(payload);
        return { success: true };
      },
    },
  },
};

const firstDelivery = await deliverCommunicationEmail({
  base44,
  svc,
  eventKey: COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
  recipientType: 'provider_user',
  recipientRefId: 'user-1',
  recipientEmail: 'owner@example.com',
  sourceEntityType: 'ProviderLead',
  sourceEntityId: 'lead-1',
  requestId: 'request-1',
  leadId: 'lead-1',
  organizationId: 'org-1',
  locationId: 'location-1',
  subject: `${providerEmail.subject}\r\nInjected: value`,
  body: providerEmail.body,
});
assert.equal(firstDelivery.status, 'sent');
assert.equal(sentEmails.length, 1);
assert.equal(rows[0].status, 'sent');
assert.ok(rows[0].recipient_email_hash);
assert.equal(Object.hasOwn(rows[0], 'recipient_email'), false);
assert.equal(Object.hasOwn(rows[0], 'body'), false);
assert.doesNotMatch(sentEmails[0].subject, /[\r\n]/);
assert.doesNotMatch(rows[0].subject_preview, /[\r\n]/);

const replay = await deliverCommunicationEmail({
  base44,
  svc,
  eventKey: COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
  recipientType: 'provider_user',
  recipientRefId: 'user-1',
  recipientEmail: 'owner@example.com',
  sourceEntityType: 'ProviderLead',
  sourceEntityId: 'lead-1',
  leadId: 'lead-1',
  locationId: 'location-1',
  subject: providerEmail.subject,
  body: providerEmail.body,
});
assert.equal(replay.idempotent_replay, true);
assert.equal(sentEmails.length, 1);

const skipped = await deliverCommunicationEmail({
  base44,
  svc,
  eventKey: COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
  recipientType: 'patient_contact',
  recipientRefId: 'contact-1',
  recipientEmail: '',
  sourceEntityType: 'ProviderLeadResponse',
  sourceEntityId: 'response-1',
  requestId: 'request-1',
  leadId: 'lead-1',
  locationId: 'location-1',
  variant: 'can_help:2026-07-19T12:00:00.000Z',
  subject: patientEmail.subject,
  body: patientEmail.body,
});
assert.equal(skipped.status, 'skipped');
assert.equal(sentEmails.length, 1);

const schema = JSON.parse(await readFile(new URL('../base44/entities/CommunicationDelivery.jsonc', import.meta.url), 'utf8'));
assert.equal(schema.rls.read.user_condition.role, 'admin');
assert.deepEqual(schema.properties.status.enum, ['pending', 'sent', 'failed', 'skipped']);
for (const forbidden of ['recipient_email', 'body', 'contact_name', 'contact_phone', 'original_message']) {
  assert.equal(schema.properties[forbidden], undefined, `${forbidden} nu trebuie stocat in jurnalul de livrare`);
}

const notifier = await readFile(new URL('../shared/leadCommunicationNotifications.js', import.meta.url), 'utf8');
const distributionBackend = await readFile(new URL('../base44/functions/authorizePatientRequestDistribution/entry.ts', import.meta.url), 'utf8');
const responseBackend = await readFile(new URL('../base44/functions/providerLeadResponseOps/entry.ts', import.meta.url), 'utf8');

assert.match(notifier, /ProviderMembership\.filter/);
assert.match(notifier, /canReceiveProviderLeadEmail/);
assert.match(notifier, /MAX_PROVIDER_LEAD_EMAIL_RECIPIENTS = 20/);
assert.match(notifier, /\.slice\(0, MAX_PROVIDER_LEAD_EMAIL_RECIPIENTS\)/);
assert.match(notifier, /svc\.entities\.User\.get/);
assert.match(notifier, /contact\.contact_email_verified !== true/);
assert.match(notifier, /patient_email_not_verified/);
assert.match(notifier, /response\.submitted_at/);
assert.match(notifier, /deliverCommunicationEmail/);
assert.doesNotMatch(notifier, /original_message|contact_phone:/);

assert.match(distributionBackend, /notifyProviderLeadAvailable/);
assert.match(distributionBackend, /Promise\.allSettled/);
assert.match(distributionBackend, /ProviderLead\.bulkCreate/);
assert.match(responseBackend, /notifyPatientProviderResponse/);
assert.match(responseBackend, /const responseChanged = !existing \|\| existing\.response_type !== responseType/);
assert.match(responseBackend, /responseChanged && lead\.request_id/);
assert.match(responseBackend, /\.catch\(\(\) => null\)/);

console.log('Lead communication event checks passed.');
