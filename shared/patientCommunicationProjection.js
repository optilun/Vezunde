import { createInAppNotification } from './inAppNotificationDelivery.js';
import { IN_APP_NOTIFICATION_EVENT_KEYS } from './inAppNotificationPolicy.js';
import { derivePatientNoResponseReview } from './patientNoResponseReview.js';

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function earliestLeadAt(leads) {
  return [...(leads || [])]
    .map((lead) => clean(lead?.eligible_at || lead?.created_date, 80))
    .filter(Boolean)
    .sort()[0] || '';
}

export async function ensurePatientCommunicationNotifications({ svc, requestId }) {
  if (!svc || !requestId) return [];
  const [request, leads, responses, matches] = await Promise.all([
    svc.entities.PatientRequest.get(requestId).catch(() => null),
    svc.entities.ProviderLead.filter({ request_id: requestId }, '-created_date', 500),
    svc.entities.ProviderLeadResponse.filter({ request_id: requestId, status: 'active' }, '-updated_date', 500),
    svc.entities.RequestMatch.filter({ request_id: requestId }, 'rank', 100),
  ]);
  if (!request) return [];

  const results = [];
  if (request.submitted_at) {
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_RECEIVED,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'PatientRequest',
      sourceEntityId: requestId,
      requestId,
      title: 'Cererea a fost salvata',
      body: 'Cererea este pastrata in siguranta si nu este distribuita fara acordul tau separat.',
      actionKind: 'request',
      actionTargetId: '',
      variant: clean(request.submitted_at, 80),
    }));
  }

  const availableLeads = leads.filter((lead) => lead.delivery_state === 'available');
  const distributedAt = earliestLeadAt(availableLeads);
  if (availableLeads.length > 0 && distributedAt) {
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_DISTRIBUTED,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'PatientRequest',
      sourceEntityId: requestId,
      requestId,
      title: 'Cererea a fost distribuita',
      body: availableLeads.length === 1
        ? 'Rezumatul este disponibil unei locatii eligibile.'
        : `Rezumatul este disponibil pentru ${availableLeads.length} locatii eligibile.`,
      actionKind: 'request',
      actionTargetId: '',
      variant: `${availableLeads.length}:${distributedAt}`,
    }));
  }

  const queryScope = request.location_scope === 'county' || matches.some((match) => match.expansion_tier === 'judet')
    ? 'county'
    : 'locality';
  const review = derivePatientNoResponseReview({
    request,
    leads,
    activeResponseCount: responses.length,
    lifecycle: {
      state: request.lifecycle_state || 'active',
      terminal: ['resolved', 'closed', 'expired'].includes(request.lifecycle_state),
    },
    queryScope,
  });
  if (review.review_available) {
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_NO_RESPONSE_REVIEW_AVAILABLE,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'PatientRequest',
      sourceEntityId: requestId,
      requestId,
      title: 'Nicio locatie nu a raspuns inca',
      body: 'Poti continua asteptarea, extinde cautarea in judet sau revizui criteriile. Nimic nu se modifica automat.',
      actionKind: 'request',
      actionTargetId: '',
      variant: clean(review.review_after, 80),
    }));
  }

  if (request.lifecycle_state === 'resolved' && request.resolved_at) {
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_RESOLVED,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'PatientRequest',
      sourceEntityId: requestId,
      requestId,
      title: 'Cererea a fost rezolvata',
      body: 'Ai marcat cererea ca rezolvata. Istoricul ramane disponibil.',
      actionKind: 'request',
      actionTargetId: '',
      variant: clean(request.resolved_at, 80),
    }));
  }

  if (request.lifecycle_state === 'closed' && request.closed_at) {
    results.push(await createInAppNotification({
      svc,
      eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_REQUEST_CLOSED,
      recipientType: 'patient_request',
      recipientRefId: requestId,
      sourceEntityType: 'PatientRequest',
      sourceEntityId: requestId,
      requestId,
      title: 'Cererea a fost inchisa',
      body: 'Cererea nu mai poate primi raspunsuri sau mesaje noi.',
      actionKind: 'request',
      actionTargetId: '',
      variant: clean(request.closed_at, 80),
    }));
  }

  return results.filter(Boolean);
}
