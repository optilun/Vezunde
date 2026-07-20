import {
  COMMUNICATION_EVENT_KEYS,
  buildPatientRequestDistributedEmail,
  buildPatientRequestLifecycleEmail,
  buildPatientRequestReceivedEmail,
} from './communicationEventCatalog.js';
import {
  deliverCommunicationEmail,
  recordSkippedCommunication,
} from './communicationDelivery.js';
import { notifyPatientRequestInApp } from './inAppNotificationDelivery.js';
import { IN_APP_NOTIFICATION_EVENT_KEYS } from './inAppNotificationPolicy.js';

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

async function patientContact(svc, requestId, explicitContact = null) {
  if (explicitContact?.id) return explicitContact;
  const rows = await svc.entities.PatientRequestContact.filter({
    request_id: requestId,
    status: 'active',
  }, '-updated_date', 2);
  return rows[0] || null;
}

async function deliverPatientEvent({
  base44,
  svc,
  request,
  contact: explicitContact = null,
  eventKey,
  sourceEntityType,
  sourceEntityId,
  variant = '',
  email,
}) {
  const contact = await patientContact(svc, request.id, explicitContact);
  if (!contact) {
    await recordSkippedCommunication({
      svc,
      eventKey,
      recipientType: 'patient_contact',
      recipientRefId: request.id,
      sourceEntityType,
      sourceEntityId,
      requestId: request.id,
      variant,
      reason: 'patient_contact_unavailable',
      subject: email.subject,
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }
  if (contact.contact_email_verified !== true) {
    await recordSkippedCommunication({
      svc,
      eventKey,
      recipientType: 'patient_contact',
      recipientRefId: contact.id,
      sourceEntityType,
      sourceEntityId,
      requestId: request.id,
      variant,
      reason: 'patient_email_not_verified',
      subject: email.subject,
    });
    return { sent: 0, failed: 0, skipped: 1 };
  }
  const result = await deliverCommunicationEmail({
    base44,
    svc,
    eventKey,
    recipientType: 'patient_contact',
    recipientRefId: contact.id,
    recipientEmail: contact.contact_email || '',
    sourceEntityType,
    sourceEntityId,
    requestId: request.id,
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

export async function notifyPatientRequestReceived({ base44, svc, request, contact }) {
  if (!request?.id) return { sent: 0, failed: 0, skipped: 0 };
  const email = buildPatientRequestReceivedEmail({
    publicReference: request.public_reference || '',
    city: request.city || '',
  });
  await notifyPatientRequestInApp({
    svc,
    requestId: request.id,
    eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_RECEIVED,
    sourceEntityType: 'PatientRequest',
    sourceEntityId: request.id,
    title: 'Cererea a fost salvata',
    body: 'Cererea este pastrata in siguranta si nu este distribuita fara acordul tau separat.',
    actionKind: 'request',
    actionTargetId: '',
    variant: clean(request.submitted_at, 80),
  }).catch(() => null);
  return deliverPatientEvent({
    base44,
    svc,
    request,
    contact,
    eventKey: COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_RECEIVED,
    sourceEntityType: 'PatientRequest',
    sourceEntityId: request.id,
    variant: clean(request.submitted_at, 80),
    email,
  });
}

export async function notifyPatientRequestDistributed({ base44, svc, request, contact, leadCount, distributedAt }) {
  if (!request?.id || Number(leadCount || 0) <= 0) return { sent: 0, failed: 0, skipped: 0 };
  const variant = `${Math.max(0, Number(leadCount) || 0)}:${clean(distributedAt, 80)}`;
  const email = buildPatientRequestDistributedEmail({
    publicReference: request.public_reference || '',
    leadCount,
  });
  await notifyPatientRequestInApp({
    svc,
    requestId: request.id,
    eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_DISTRIBUTED,
    sourceEntityType: 'PatientRequest',
    sourceEntityId: request.id,
    title: 'Cererea a fost distribuita',
    body: Number(leadCount) === 1
      ? 'Rezumatul este disponibil unei locatii eligibile.'
      : `Rezumatul este disponibil pentru ${Number(leadCount)} locatii eligibile.`,
    actionKind: 'request',
    actionTargetId: '',
    variant,
  }).catch(() => null);
  return deliverPatientEvent({
    base44,
    svc,
    request,
    contact,
    eventKey: COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_DISTRIBUTED,
    sourceEntityType: 'PatientRequest',
    sourceEntityId: request.id,
    variant,
    email,
  });
}

export async function notifyPatientRequestLifecycle({ base44, svc, request, contact, state, eventAt }) {
  if (!request?.id || !['resolved', 'closed'].includes(state)) return { sent: 0, failed: 0, skipped: 0 };
  const eventKey = state === 'resolved'
    ? COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_RESOLVED
    : COMMUNICATION_EVENT_KEYS.PATIENT_REQUEST_CLOSED;
  const inAppEventKey = state === 'resolved'
    ? IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_RESOLVED
    : IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_CLOSED;
  const variant = `${state}:${clean(eventAt, 80)}`;
  const email = buildPatientRequestLifecycleEmail({
    publicReference: request.public_reference || '',
    state,
  });
  await notifyPatientRequestInApp({
    svc,
    requestId: request.id,
    eventKey: inAppEventKey,
    sourceEntityType: 'PatientRequest',
    sourceEntityId: request.id,
    title: state === 'resolved' ? 'Cererea a fost rezolvata' : 'Cererea a fost inchisa',
    body: state === 'resolved'
      ? 'Ai marcat cererea ca rezolvata. Istoricul ramane disponibil.'
      : 'Cererea este inchisa si nu mai poate primi activitate noua.',
    actionKind: 'request',
    actionTargetId: '',
    variant,
  }).catch(() => null);
  return deliverPatientEvent({
    base44,
    svc,
    request,
    contact,
    eventKey,
    sourceEntityType: 'PatientRequest',
    sourceEntityId: request.id,
    variant,
    email,
  });
}
