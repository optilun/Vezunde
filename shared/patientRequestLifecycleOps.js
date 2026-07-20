import {
  PATIENT_REQUEST_LIFECYCLE_STATES,
  canTransitionPatientRequestLifecycle,
  derivePatientRequestLifecycle,
  patientRequestHasExpired,
  patientRequestLifecyclePatch,
  persistedPatientRequestLifecycleState,
} from './patientRequestLifecyclePolicy.js';
import {
  acquirePatientRequestLifecycleLock,
  releasePatientRequestLifecycleLock,
} from './patientRequestLifecycleLock.js';
import {
  acquireControlledChatMessageLock,
  releaseControlledChatMessageLock,
} from './controlledChatLock.js';

function closureMetadata(targetState, now) {
  if (targetState === PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED) {
    return { leadStatus: 'expired', deliveryState: 'expired', reason: 'request_expired', closedBy: 'system', now };
  }
  if (targetState === PATIENT_REQUEST_LIFECYCLE_STATES.RESOLVED) {
    return { leadStatus: 'closed', deliveryState: 'withdrawn', reason: 'request_resolved', closedBy: 'patient', now };
  }
  return { leadStatus: 'closed', deliveryState: 'withdrawn', reason: 'request_closed', closedBy: 'patient', now };
}

async function loadRelatedRows(svc, requestId) {
  const [leads, responses, conversations, approvals] = await Promise.all([
    svc.entities.ProviderLead.filter({ request_id: requestId }, '-created_date', 500),
    svc.entities.ProviderLeadResponse.filter({ request_id: requestId, status: 'active' }, '-updated_date', 500),
    svc.entities.PatientRequestConversation.filter({ request_id: requestId }, '-updated_date', 500),
    svc.entities.ContactShareApproval.filter({ request_id: requestId }, '-updated_date', 500),
  ]);
  return { leads, responses, conversations, approvals };
}

export async function deriveStoredPatientRequestLifecycle(svc, request, now = new Date()) {
  const related = await loadRelatedRows(svc, request.id);
  const lifecycle = derivePatientRequestLifecycle({
    request,
    leadCount: related.leads.filter((lead) => lead.delivery_state === 'available').length,
    activeResponseCount: related.responses.length,
    openConversationCount: related.conversations.filter((conversation) => conversation.status === 'open').length,
    now,
  });
  return { lifecycle, related };
}

async function acquireConversationLocks(svc, conversations) {
  const locks = [];
  for (const conversation of conversations.filter((row) => row.status === 'open')) {
    const lock = await acquireControlledChatMessageLock(svc, conversation.id);
    if (!lock) {
      await Promise.allSettled(locks.map((item) => releaseControlledChatMessageLock(svc, item)));
      return null;
    }
    locks.push(lock);
  }
  return locks;
}

async function releaseConversationLocks(svc, locks) {
  await Promise.allSettled((locks || []).map((lock) => releaseControlledChatMessageLock(svc, lock)));
}

export async function transitionPatientRequestLifecycle({ svc, requestId, targetState, actor = 'patient' }) {
  const lifecycleLock = await acquirePatientRequestLifecycleLock(svc, requestId);
  if (!lifecycleLock) return { error: 'Cererea este actualizata in alta sesiune. Reincearca.', status: 409 };
  let conversationLocks = [];
  try {
    const request = await svc.entities.PatientRequest.get(requestId).catch(() => null);
    if (!request) return { error: 'Cererea nu a fost gasita.', status: 404 };
    const currentState = persistedPatientRequestLifecycleState(request);
    const effectiveTarget = patientRequestHasExpired(request)
      ? PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED
      : targetState;
    if (!canTransitionPatientRequestLifecycle(currentState, effectiveTarget)) {
      return { error: 'Starea cererii nu mai permite aceasta actiune.', status: 409 };
    }
    if (currentState === effectiveTarget) {
      const snapshot = await deriveStoredPatientRequestLifecycle(svc, request);
      return { request, lifecycle: snapshot.lifecycle, idempotent_replay: true };
    }

    const related = await loadRelatedRows(svc, requestId);
    const acquired = await acquireConversationLocks(svc, related.conversations);
    if (!acquired) return { error: 'O conversatie este actualizata in alta sesiune. Reincearca.', status: 409 };
    conversationLocks = acquired;

    const now = new Date();
    const nowIso = now.toISOString();
    const closure = closureMetadata(effectiveTarget, nowIso);
    const updatedRequest = await svc.entities.PatientRequest.update(
      requestId,
      patientRequestLifecyclePatch(effectiveTarget, actor, now),
    );

    await Promise.allSettled(related.conversations
      .filter((conversation) => conversation.status === 'open')
      .map((conversation) => svc.entities.PatientRequestConversation.update(conversation.id, {
        status: 'closed',
        closed_at: nowIso,
        closed_by: closure.closedBy,
        patient_unread_count: 0,
        provider_unread_count: 0,
      })));

    await Promise.allSettled(related.approvals
      .filter((approval) => approval.status === 'approved')
      .map((approval) => svc.entities.ContactShareApproval.update(approval.id, {
        status: 'revoked',
        allowed_contact_fields: [],
        revoked_at: nowIso,
      })));

    await Promise.allSettled(related.leads.map((lead) => svc.entities.ProviderLead.update(lead.id, {
      status: closure.leadStatus,
      delivery_state: closure.deliveryState,
      contact_access_state: 'revoked',
      conversation_access_state: 'locked',
      closure_reason: closure.reason,
      closed_at: nowIso,
      last_contact_approval_at: nowIso,
      last_conversation_at: nowIso,
    })));

    return {
      request: updatedRequest,
      lifecycle: {
        state: effectiveTarget,
        stage: effectiveTarget,
        terminal: true,
      },
      idempotent_replay: false,
    };
  } finally {
    await releaseConversationLocks(svc, conversationLocks);
    await releasePatientRequestLifecycleLock(svc, lifecycleLock);
  }
}

export async function reconcilePatientRequestExpiration(svc, requestId) {
  const request = await svc.entities.PatientRequest.get(requestId).catch(() => null);
  if (!request) return { request: null, lifecycle: null, changed: false };
  const state = persistedPatientRequestLifecycleState(request);
  if (state !== PATIENT_REQUEST_LIFECYCLE_STATES.ACTIVE || !patientRequestHasExpired(request)) {
    const snapshot = await deriveStoredPatientRequestLifecycle(svc, request);
    return { request, lifecycle: snapshot.lifecycle, changed: false };
  }
  const transitioned = await transitionPatientRequestLifecycle({
    svc,
    requestId,
    targetState: PATIENT_REQUEST_LIFECYCLE_STATES.EXPIRED,
    actor: 'system',
  });
  if (transitioned.error) return { request, lifecycle: null, changed: false, error: transitioned.error };
  return { request: transitioned.request, lifecycle: transitioned.lifecycle, changed: true };
}
