import {
  COMMUNICATION_EVENT_KEYS,
  buildPatientProviderResponseEmail,
  buildProviderLeadAvailableEmail,
  canReceiveProviderLeadEmail,
} from './communicationEventCatalog.js';
import {
  deliverCommunicationEmail,
  recordSkippedCommunication,
} from './communicationDelivery.js';
import {
  notifyPatientRequestInApp,
  notifyProviderUsersInApp,
} from './inAppNotificationDelivery.js';
import { IN_APP_NOTIFICATION_EVENT_KEYS } from './inAppNotificationPolicy.js';

const MAX_PROVIDER_LEAD_EMAIL_RECIPIENTS = 20;

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function uniqueProviderRecipients(memberships) {
  const byUser = new Map();
  for (const membership of memberships || []) {
    if (!membership?.user_id || membership.status !== 'active') continue;
    if (!canReceiveProviderLeadEmail(membership.role)) continue;
    if (!byUser.has(membership.user_id)) byUser.set(membership.user_id, membership);
  }
  return [...byUser.values()];
}

function patientResponseBody(responseType) {
  if (responseType === 'can_help') return 'Locatia a confirmat ca poate analiza cererea ta.';
  if (responseType === 'needs_details') return 'Locatia are nevoie de informatii suplimentare.';
  return 'Locatia a transmis ca nu poate ajuta momentan.';
}

export async function notifyProviderLeadAvailable({ base44, svc, lead, location }) {
  if (!lead?.id || !location?.id) return { sent: 0, failed: 0, skipped: 0 };
  const memberships = await svc.entities.ProviderMembership.filter({
    location_id: location.id,
    status: 'active',
  }, '-created_date', 500);
  const recipients = uniqueProviderRecipients(memberships).slice(0, MAX_PROVIDER_LEAD_EMAIL_RECIPIENTS);
  const email = buildProviderLeadAvailableEmail({
    locationName: location.public_display_name || location.name || 'Locatia ta',
    city: lead.city || location.locality_name || location.city || '',
    intentLabel: lead.intent_label || '',
  });

  await notifyProviderUsersInApp({
    svc,
    locationId: location.id,
    eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
    sourceEntityType: 'ProviderLead',
    sourceEntityId: lead.id,
    requestId: lead.request_id || '',
    leadId: lead.id,
    organizationId: lead.organization_id || location.organization_id || '',
    title: 'Cerere noua relevanta',
    body: [lead.intent_label || 'Cerere client', lead.city || location.locality_name || location.city || ''].filter(Boolean).join(' · '),
    actionKind: 'lead',
    actionTargetId: lead.id,
  }).catch(() => []);

  if (recipients.length === 0) {
    await recordSkippedCommunication({
      svc,
      eventKey: COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
      recipientType: 'provider_location',
      recipientRefId: location.id,
      sourceEntityType: 'ProviderLead',
      sourceEntityId: lead.id,
      requestId: lead.request_id || '',
      leadId: lead.id,
      organizationId: lead.organization_id || location.organization_id || '',
      locationId: location.id,
      reason: 'no_active_owner_or_manager',
      subject: email.subject,
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const results = [];
  for (const membership of recipients) {
    const user = await svc.entities.User.get(membership.user_id).catch(() => null);
    const result = await deliverCommunicationEmail({
      base44,
      svc,
      eventKey: COMMUNICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
      recipientType: 'provider_user',
      recipientRefId: membership.user_id,
      recipientEmail: user?.email || '',
      sourceEntityType: 'ProviderLead',
      sourceEntityId: lead.id,
      requestId: lead.request_id || '',
      leadId: lead.id,
      organizationId: lead.organization_id || location.organization_id || '',
      locationId: location.id,
      subject: email.subject,
      body: email.body,
    });
    results.push(result);
  }

  return {
    sent: results.filter((result) => result.status === 'sent').length,
    failed: results.filter((result) => result.status === 'failed').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
  };
}

export async function notifyPatientProviderResponse({ base44, svc, lead, response, location, request }) {
  if (!lead?.id || !response?.id || !location?.id || !request?.id) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const contacts = await svc.entities.PatientRequestContact.filter({
    request_id: request.id,
    status: 'active',
  }, '-updated_date', 2);
  const contact = contacts[0] || null;
  const locationName = location.public_display_name || location.name || 'O locatie';
  const email = buildPatientProviderResponseEmail({
    publicReference: request.public_reference || '',
    locationName,
    responseType: response.response_type || '',
  });
  const variant = `${clean(response.response_type, 80)}:${clean(response.submitted_at, 80)}`;

  await notifyPatientRequestInApp({
    svc,
    requestId: request.id,
    eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
    sourceEntityType: 'ProviderLeadResponse',
    sourceEntityId: response.id,
    leadId: lead.id,
    organizationId: lead.organization_id || location.organization_id || '',
    locationId: location.id,
    title: `Raspuns nou de la ${locationName}`,
    body: patientResponseBody(response.response_type),
    actionKind: 'request',
    actionTargetId: location.id,
    variant,
  }).catch(() => null);

  if (!contact) {
    await recordSkippedCommunication({
      svc,
      eventKey: COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
      recipientType: 'patient_contact',
      recipientRefId: request.id,
      sourceEntityType: 'ProviderLeadResponse',
      sourceEntityId: response.id,
      requestId: request.id,
      leadId: lead.id,
      organizationId: lead.organization_id || location.organization_id || '',
      locationId: location.id,
      variant,
      reason: 'patient_contact_unavailable',
      subject: email.subject,
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }

  if (contact.contact_email_verified !== true) {
    await recordSkippedCommunication({
      svc,
      eventKey: COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
      recipientType: 'patient_contact',
      recipientRefId: contact.id,
      sourceEntityType: 'ProviderLeadResponse',
      sourceEntityId: response.id,
      requestId: request.id,
      leadId: lead.id,
      organizationId: lead.organization_id || location.organization_id || '',
      locationId: location.id,
      variant,
      reason: 'patient_email_not_verified',
      subject: email.subject,
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }

  const result = await deliverCommunicationEmail({
    base44,
    svc,
    eventKey: COMMUNICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
    recipientType: 'patient_contact',
    recipientRefId: contact.id,
    recipientEmail: contact.contact_email || '',
    sourceEntityType: 'ProviderLeadResponse',
    sourceEntityId: response.id,
    requestId: request.id,
    leadId: lead.id,
    organizationId: lead.organization_id || location.organization_id || '',
    locationId: location.id,
    variant,
    subject: email.subject,
    body: email.body,
  });
  return {
    sent: result.status === 'sent' ? 1 : 0,
    failed: result.status === 'failed' ? 1 : 0,
    skipped: result.status === 'skipped' ? 1 : 0,
  };
}
