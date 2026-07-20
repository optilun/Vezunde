import { createInAppNotification } from './inAppNotificationDelivery.js';
import { IN_APP_NOTIFICATION_EVENT_KEYS } from './inAppNotificationPolicy.js';

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function patientResponseBody(responseType) {
  if (responseType === 'can_help') return 'Locatia a confirmat ca poate analiza cererea ta.';
  if (responseType === 'needs_details') return 'Locatia are nevoie de informatii suplimentare.';
  return 'Locatia a transmis ca nu poate ajuta momentan.';
}

async function locationName(svc, locationId) {
  if (!locationId) return 'Locatie';
  const location = await svc.entities.ProviderLocation.get(locationId).catch(() => null);
  return location?.public_display_name || location?.name || 'Locatie';
}

export async function ensureProviderInAppNotifications({ svc, userId, locationId }) {
  if (!svc || !userId || !locationId) return [];
  const [leads, conversations, messages, approvals] = await Promise.all([
    svc.entities.ProviderLead.filter({ location_id: locationId, delivery_state: 'available' }, '-created_date', 300),
    svc.entities.PatientRequestConversation.filter({ location_id: locationId }, '-updated_date', 300),
    svc.entities.PatientRequestMessage.filter({ location_id: locationId, sender_type: 'patient', status: 'active' }, '-created_date', 300),
    svc.entities.ContactShareApproval.filter({ location_id: locationId }, '-updated_date', 300),
  ]);
  const results = [];

  for (const lead of leads) {
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_LEAD_AVAILABLE,
      recipientType: 'provider_user',
      recipientRefId: userId,
      sourceEntityType: 'ProviderLead',
      sourceEntityId: lead.id,
      requestId: lead.request_id || '',
      leadId: lead.id,
      organizationId: lead.organization_id || '',
      locationId,
      title: 'Cerere noua relevanta',
      body: [lead.intent_label || 'Cerere client', lead.city || ''].filter(Boolean).join(' · '),
      actionKind: 'lead',
      actionTargetId: lead.id,
    }));
  }

  for (const conversation of conversations) {
    if (conversation.opened_by === 'patient' && (conversation.opened_at || conversation.reopened_at)) {
      const openedAt = conversation.reopened_at || conversation.opened_at;
      results.push(await createInAppNotification({
        svc,
        eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_CHAT_OPENED,
        recipientType: 'provider_user',
        recipientRefId: userId,
        sourceEntityType: 'PatientRequestConversation',
        sourceEntityId: conversation.id,
        requestId: conversation.request_id || '',
        leadId: conversation.lead_id || '',
        organizationId: conversation.organization_id || '',
        locationId,
        title: 'Clientul a deschis conversatia',
        body: 'Poti raspunde in chatul VIASEE din leadul asociat.',
        actionKind: 'chat',
        actionTargetId: conversation.lead_id || '',
        variant: clean(openedAt, 80),
      }));
    }
    if (conversation.status === 'closed' && conversation.closed_by === 'patient' && conversation.closed_at) {
      results.push(await createInAppNotification({
        svc,
        eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_CONVERSATION_CLOSED,
        recipientType: 'provider_user',
        recipientRefId: userId,
        sourceEntityType: 'PatientRequestConversation',
        sourceEntityId: conversation.id,
        requestId: conversation.request_id || '',
        leadId: conversation.lead_id || '',
        organizationId: conversation.organization_id || '',
        locationId,
        title: 'Clientul a inchis conversatia',
        body: 'Istoricul ramane disponibil conform regulilor planului.',
        actionKind: 'chat',
        actionTargetId: conversation.lead_id || '',
        variant: clean(conversation.closed_at, 80),
      }));
    }
  }

  for (const message of messages) {
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_CHAT_MESSAGE_RECEIVED,
      recipientType: 'provider_user',
      recipientRefId: userId,
      sourceEntityType: 'PatientRequestMessage',
      sourceEntityId: message.id,
      requestId: message.request_id || '',
      leadId: message.lead_id || '',
      organizationId: message.organization_id || '',
      locationId,
      title: 'Mesaj nou de la client',
      body: 'Ai primit un mesaj nou in chatul VIASEE.',
      actionKind: 'chat',
      actionTargetId: message.lead_id || '',
      variant: clean(message.sent_at || message.created_date, 80),
    }));
  }

  for (const approval of approvals) {
    const approved = approval.status === 'approved';
    const revoked = approval.status === 'revoked';
    if (!approved && !revoked) continue;
    const eventAt = approved ? approval.approved_at : approval.revoked_at;
    results.push(await createInAppNotification({
      svc,
      eventKey: approved
        ? IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_PHONE_APPROVED
        : IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_PHONE_REVOKED,
      recipientType: 'provider_user',
      recipientRefId: userId,
      sourceEntityType: 'ContactShareApproval',
      sourceEntityId: approval.id,
      requestId: approval.request_id || '',
      leadId: approval.lead_id || '',
      organizationId: approval.organization_id || '',
      locationId,
      title: approved ? 'Telefon aprobat de client' : 'Accesul la telefon a fost retras',
      body: approved
        ? 'Numarul poate fi deschis din controlul separat al leadului.'
        : 'Numarul de telefon nu mai este disponibil acestei locatii.',
      actionKind: 'contact',
      actionTargetId: approval.lead_id || '',
      variant: `${approval.status}:${clean(eventAt || approval.updated_date, 80)}`,
    }));
  }

  return results.filter(Boolean);
}

export async function ensurePatientInAppNotifications({ svc, requestId }) {
  if (!svc || !requestId) return [];
  const [responses, messages, conversations] = await Promise.all([
    svc.entities.ProviderLeadResponse.filter({ request_id: requestId, status: 'active' }, '-updated_date', 100),
    svc.entities.PatientRequestMessage.filter({ request_id: requestId, sender_type: 'provider', status: 'active' }, '-created_date', 300),
    svc.entities.PatientRequestConversation.filter({ request_id: requestId }, '-updated_date', 100),
  ]);
  const results = [];

  for (const response of responses) {
    const name = await locationName(svc, response.location_id);
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_PROVIDER_RESPONSE_RECEIVED,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'ProviderLeadResponse',
      sourceEntityId: response.id,
      requestId,
      leadId: response.lead_id || '',
      organizationId: response.organization_id || '',
      locationId: response.location_id || '',
      title: `Raspuns nou de la ${name}`,
      body: patientResponseBody(response.response_type),
      actionKind: 'request',
      actionTargetId: response.location_id || '',
      variant: `${clean(response.response_type, 80)}:${clean(response.submitted_at || response.updated_date, 80)}`,
    }));
  }

  for (const message of messages) {
    const name = await locationName(svc, message.location_id);
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_CHAT_MESSAGE_RECEIVED,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'PatientRequestMessage',
      sourceEntityId: message.id,
      requestId,
      leadId: message.lead_id || '',
      organizationId: message.organization_id || '',
      locationId: message.location_id || '',
      title: `Mesaj nou de la ${name}`,
      body: 'Ai primit un mesaj nou in chatul VIASEE.',
      actionKind: 'chat',
      actionTargetId: message.location_id || '',
      variant: clean(message.sent_at || message.created_date, 80),
    }));
  }

  for (const conversation of conversations) {
    if (conversation.status !== 'closed' || !['provider', 'system'].includes(conversation.closed_by) || !conversation.closed_at) continue;
    const name = await locationName(svc, conversation.location_id);
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_CONVERSATION_CLOSED,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'PatientRequestConversation',
      sourceEntityId: conversation.id,
      requestId,
      leadId: conversation.lead_id || '',
      organizationId: conversation.organization_id || '',
      locationId: conversation.location_id || '',
      title: `Conversatie inchisa de ${name}`,
      body: 'Istoricul conversatiei ramane vizibil in cererea ta.',
      actionKind: 'chat',
      actionTargetId: conversation.location_id || '',
      variant: clean(conversation.closed_at, 80),
    }));
  }

  return results.filter(Boolean);
}
