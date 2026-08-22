import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { canAccessProviderLeadInbox } from '../../shared/providerLeadInboxPolicy.js';
import { resolveProviderEntitlement } from '../../shared/providerEntitlementPolicy.js';
import {
  CONTROLLED_CHAT_CONTRACT_VERSION,
  CONTROLLED_CHAT_MESSAGE_CONTRACT_VERSION,
  controlledChatEligibility,
  controlledChatRateLimitState,
  sanitizeControlledChatConversation,
  sanitizeControlledChatMessage,
  validateControlledChatMessage,
} from '../../shared/controlledChatPolicy.js';
import {
  acquireControlledChatMessageLock,
  acquireControlledChatOpenLock,
  releaseControlledChatMessageLock,
  releaseControlledChatOpenLock,
} from '../../shared/controlledChatLock.js';
import {
  notifyPatientRequestInApp,
  notifyProviderUsersInApp,
} from '../../shared/inAppNotificationDelivery.js';
import { IN_APP_NOTIFICATION_EVENT_KEYS } from '../../shared/inAppNotificationPolicy.js';

const ACTORS = new Set(['patient', 'provider']);
const ACTIONS = new Set(['status', 'open', 'send', 'mark_read', 'close']);

function res(body, status = 200) {
  return Response.json(body, { status });
}

function clean(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ''));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function findConversation(svc, lead) {
  const rows = await svc.entities.PatientRequestConversation.filter({
    lead_id: lead.id,
    location_id: lead.location_id,
  }, '-updated_date', 10);
  return rows[0] || null;
}

async function findActiveResponse(svc, lead) {
  const rows = await svc.entities.ProviderLeadResponse.filter({
    lead_id: lead.id,
    location_id: lead.location_id,
    status: 'active',
  }, '-updated_date', 20);
  return rows[0] || null;
}

async function resolveEntitlement(svc, locationId) {
  const rows = await svc.entities.ProviderSubscription.filter({ location_id: locationId }, '-created_date', 100);
  return resolveProviderEntitlement(rows);
}

async function loadMessages(svc, conversationId) {
  if (!conversationId) return [];
  return svc.entities.PatientRequestMessage.filter({
    conversation_id: conversationId,
    status: 'active',
  }, 'created_date', 200);
}

async function authorizePatientRequest(svc, requestId, accessToken) {
  const request = await svc.entities.PatientRequest.get(requestId).catch(() => null);
  if (!request) return { error: 'Cererea nu a fost gasita.', status: 404 };
  const tokenHash = await sha256(accessToken);
  const contacts = await svc.entities.PatientRequestContact.filter({
    request_id: requestId,
    access_token_hash: tokenHash,
    status: 'active',
  }, '-updated_date', 2);
  const contact = contacts[0] || null;
  if (!contact) return { error: 'Accesul la cerere nu este valid.', status: 403 };
  return { request, contact };
}

async function loadPatientContext(svc, input) {
  const requestId = clean(input.request_id, 120);
  const accessToken = clean(input.request_access_token, 160);
  const locationId = clean(input.location_id, 120);
  if (!requestId || !accessToken || !locationId) {
    return { error: 'request_id, tokenul de acces si location_id sunt obligatorii.', status: 400 };
  }

  const authorized = await authorizePatientRequest(svc, requestId, accessToken);
  if (authorized.error) return authorized;
  const leads = await svc.entities.ProviderLead.filter({
    request_id: requestId,
    location_id: locationId,
  }, '-created_date', 20);
  const lead = leads[0] || null;
  if (!lead) return { error: 'Locatia nu face parte din cererea curenta.', status: 404 };

  const [location, response, entitlement, conversation] = await Promise.all([
    svc.entities.ProviderLocation.get(locationId).catch(() => null),
    findActiveResponse(svc, lead),
    resolveEntitlement(svc, locationId),
    findConversation(svc, lead),
  ]);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };

  return {
    actor: 'patient',
    request: authorized.request,
    contact: authorized.contact,
    accessToken,
    lead,
    location,
    response,
    entitlement,
    conversation,
    user: null,
  };
}

async function loadProviderContext(base44, svc, input) {
  const user = await base44.auth.me();
  if (!user) return { error: 'Autentificare necesara.', status: 401 };
  const locationId = clean(input.location_id, 120);
  const leadId = clean(input.lead_id, 120);
  if (!locationId || !leadId) return { error: 'location_id si lead_id sunt obligatorii.', status: 400 };

  const [location, lead] = await Promise.all([
    svc.entities.ProviderLocation.get(locationId).catch(() => null),
    svc.entities.ProviderLead.get(leadId).catch(() => null),
  ]);
  if (!location) return { error: 'Locatia nu a fost gasita.', status: 404 };
  if (!lead || lead.location_id !== locationId) return { error: 'Leadul nu a fost gasit.', status: 404 };

  const memberships = await svc.entities.ProviderMembership.filter({
    user_id: user.id,
    location_id: locationId,
    status: 'active',
  }, '-created_date', 20);
  const membership = memberships.find((row) => canAccessProviderLeadInbox(row?.role));
  if (!membership) return { error: 'Nu ai acces la conversatiile acestei locatii.', status: 403 };

  const [request, contacts, response, entitlement, conversation] = await Promise.all([
    svc.entities.PatientRequest.get(lead.request_id).catch(() => null),
    svc.entities.PatientRequestContact.filter({ request_id: lead.request_id, status: 'active' }, '-updated_date', 2),
    findActiveResponse(svc, lead),
    resolveEntitlement(svc, locationId),
    findConversation(svc, lead),
  ]);
  const contact = contacts[0] || null;
  if (!request) return { error: 'Cererea nu mai este disponibila.', status: 409 };
  if (!contact) return { error: 'Datele cererii nu mai sunt disponibile.', status: 409 };

  return {
    actor: 'provider',
    request,
    contact,
    lead,
    location,
    response,
    entitlement,
    conversation,
    user,
  };
}

function eligibilityWithoutClosedConversation(context) {
  return controlledChatEligibility({
    request: context.request,
    lead: context.lead,
    response: context.response,
    entitlement: context.entitlement,
    contact: context.contact,
    conversation: null,
  });
}

async function buildStatusPayload(svc, context) {
  const baseEligibility = eligibilityWithoutClosedConversation(context);
  const conversation = context.conversation;
  const isOpen = conversation?.status === 'open';
  const providerEntitled = context.entitlement?.plan_code === 'pro'
    && context.entitlement?.feature_keys?.includes('provider_chat.access');
  const messages = conversation && (context.actor === 'patient' || providerEntitled)
    ? await loadMessages(svc, conversation.id)
    : [];
  const unreadCount = context.actor === 'provider'
    ? conversation?.provider_unread_count
    : conversation?.patient_unread_count;

  // "Vazut" pentru ultimul mesaj propriu: comparam momentul ultimului mesaj trimis de cel
  // care priveste cu momentul in care celalalt a citit ultima oara. Ambele campuri exista
  // deja pe conversatie; pana acum nu erau folosite nicaieri in interfata. Trimitem catre
  // client doar rezultatul boolean, nu si timestamp-ul celuilalt.
  const ownLastMessageAt = context.actor === 'provider'
    ? conversation?.provider_last_message_at
    : conversation?.patient_last_message_at;
  const otherLastReadAt = context.actor === 'provider'
    ? conversation?.patient_last_read_at
    : conversation?.provider_last_read_at;
  const ownLastMessageMs = Date.parse(String(ownLastMessageAt || ''));
  const otherLastReadMs = Date.parse(String(otherLastReadAt || ''));
  const lastOwnMessageSeen = Number.isFinite(ownLastMessageMs)
    && Number.isFinite(otherLastReadMs)
    && otherLastReadMs >= ownLastMessageMs;

  return {
    chat_contract_version: CONTROLLED_CHAT_CONTRACT_VERSION,
    location: {
      id: context.location.id,
      name: context.location.public_display_name || context.location.name || 'Locatie',
    },
    chat: sanitizeControlledChatConversation(conversation, {
      canOpen: context.actor === 'patient' && baseEligibility.eligible && !isOpen,
      canSend: baseEligibility.eligible && isOpen,
      unreadCount,
      lastOwnMessageSeen,
    }),
    messages: messages.map(sanitizeControlledChatMessage),
    eligibility_reasons: baseEligibility.reasons,
    provider_plan: context.entitlement?.plan_code || 'free',
  };
}

function locationLabel(location) {
  return location?.public_display_name || location?.name || 'Locatie';
}

// Notificarile in-app pentru chat se creau pana acum DOAR lene, la urmatoarea citire a listei
// de notificari (ensureProviderInAppNotifications / ensurePatientInAppNotifications). Efectul
// practic: destinatarul afla de un mesaj nou abia cand deschidea clopotelul, deci conversatia
// parea moarta chiar daca celalalt raspunsese deja.
//
// Le cream acum si in momentul evenimentului, cu EXACT aceleasi chei de idempotenta ca
// proiectia lenesa (acelasi eventKey, recipientType, recipientRefId, sourceEntityId si
// variant), astfel incat proiectia ulterioara sa gaseasca notificarea deja existenta si sa
// fie un no-op. Nu se schimba nici cine primeste notificarea, nici ce contine - doar cand
// apare.
//
// Orice esec de aici este inghitit intentionat: o notificare ratata nu trebuie sa strice
// trimiterea mesajului, iar proiectia lenesa ramane plasa de siguranta care o va crea oricum
// la urmatoarea citire.
async function notifyChatEvent(svc, context, event) {
  try {
    if (event.kind === 'message') {
      const message = event.message;
      if (!message?.id) return;
      const variant = clean(message.sent_at || message.created_date, 80);
      if (context.actor === 'patient') {
        await notifyProviderUsersInApp({
          svc,
          locationId: context.location.id,
          eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_CHAT_MESSAGE_RECEIVED,
          sourceEntityType: 'PatientRequestMessage',
          sourceEntityId: message.id,
          requestId: message.request_id || '',
          leadId: message.lead_id || '',
          organizationId: message.organization_id || '',
          title: 'Mesaj nou de la client',
          body: 'Ai primit un mesaj nou in chatul VIASEE.',
          actionKind: 'chat',
          actionTargetId: message.lead_id || '',
          variant,
        });
        return;
      }
      await notifyPatientRequestInApp({
        svc,
        requestId: message.request_id || context.request?.id || '',
        eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_CHAT_MESSAGE_RECEIVED,
        sourceEntityType: 'PatientRequestMessage',
        sourceEntityId: message.id,
        leadId: message.lead_id || '',
        organizationId: message.organization_id || '',
        locationId: message.location_id || '',
        title: `Mesaj nou de la ${locationLabel(context.location)}`,
        body: 'Ai primit un mesaj nou in chatul VIASEE.',
        actionKind: 'chat',
        actionTargetId: message.location_id || '',
        variant,
      });
      return;
    }

    const conversation = event.conversation;
    if (!conversation?.id) return;

    if (event.kind === 'opened') {
      // Conversatia poate fi deschisa numai de pacient, deci destinatarul e mereu locatia.
      await notifyProviderUsersInApp({
        svc,
        locationId: context.location.id,
        eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_CHAT_OPENED,
        sourceEntityType: 'PatientRequestConversation',
        sourceEntityId: conversation.id,
        requestId: conversation.request_id || '',
        leadId: conversation.lead_id || '',
        organizationId: conversation.organization_id || '',
        title: 'Clientul a deschis conversatia',
        body: 'Poti raspunde in chatul VIASEE din leadul asociat.',
        actionKind: 'chat',
        actionTargetId: conversation.lead_id || '',
        variant: clean(conversation.reopened_at || conversation.opened_at, 80),
      });
      return;
    }

    if (event.kind === 'closed') {
      const variant = clean(conversation.closed_at, 80);
      if (conversation.closed_by === 'patient') {
        await notifyProviderUsersInApp({
          svc,
          locationId: context.location.id,
          eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PROVIDER_CONVERSATION_CLOSED,
          sourceEntityType: 'PatientRequestConversation',
          sourceEntityId: conversation.id,
          requestId: conversation.request_id || '',
          leadId: conversation.lead_id || '',
          organizationId: conversation.organization_id || '',
          title: 'Clientul a inchis conversatia',
          body: 'Istoricul ramane disponibil conform regulilor planului.',
          actionKind: 'chat',
          actionTargetId: conversation.lead_id || '',
          variant,
        });
        return;
      }
      await notifyPatientRequestInApp({
        svc,
        requestId: conversation.request_id || context.request?.id || '',
        eventKey: IN_APP_NOTIFICATION_EVENT_KEYS.PATIENT_CONVERSATION_CLOSED,
        sourceEntityType: 'PatientRequestConversation',
        sourceEntityId: conversation.id,
        leadId: conversation.lead_id || '',
        organizationId: conversation.organization_id || '',
        locationId: conversation.location_id || '',
        title: `Conversatie inchisa de ${locationLabel(context.location)}`,
        body: 'Istoricul conversatiei ramane vizibil in cererea ta.',
        actionKind: 'chat',
        actionTargetId: conversation.location_id || '',
        variant,
      });
    }
  } catch (_error) {
    // Proiectia lenesa ramane plasa de siguranta pentru notificarea ratata aici.
  }
}

async function openConversation(svc, context) {
  if (context.actor !== 'patient') return { error: 'Conversatia poate fi deschisa numai de client.', status: 403 };
  const eligibility = eligibilityWithoutClosedConversation(context);
  if (!eligibility.eligible) {
    return { error: 'Conversatia nu este disponibila pentru aceasta locatie.', status: 409, reasons: eligibility.reasons };
  }

  const openLock = await acquireControlledChatOpenLock(svc, context.lead.id);
  if (!openLock) return { error: 'Conversatia este actualizata in alta sesiune. Reincearca.', status: 409 };
  try {
    const checked = await loadPatientContext(svc, {
      request_id: context.request.id,
      request_access_token: context.accessToken,
      location_id: context.location.id,
    });
    if (checked.error) return checked;
    const checkedEligibility = eligibilityWithoutClosedConversation(checked);
    if (!checkedEligibility.eligible) {
      return { error: 'Conversatia nu mai este disponibila pentru aceasta locatie.', status: 409, reasons: checkedEligibility.reasons };
    }

    const now = new Date().toISOString();
    let conversation = checked.conversation;
    if (conversation?.status === 'open') {
      return { context: checked, conversation, idempotent_replay: true };
    }
    if (conversation) {
      conversation = await svc.entities.PatientRequestConversation.update(conversation.id, {
        status: 'open',
        reopened_at: now,
        patient_last_read_at: now,
      });
    } else {
      conversation = await svc.entities.PatientRequestConversation.create({
        conversation_contract_version: CONTROLLED_CHAT_CONTRACT_VERSION,
        request_id: checked.lead.request_id,
        lead_id: checked.lead.id,
        organization_id: checked.lead.organization_id || checked.location.organization_id || '',
        location_id: checked.location.id,
        status: 'open',
        opened_by: 'patient',
        opened_at: now,
        patient_last_read_at: now,
        patient_unread_count: 0,
        provider_unread_count: 0,
      });
    }
    await svc.entities.ProviderLead.update(checked.lead.id, {
      conversation_access_state: 'available',
      last_conversation_at: now,
    });
    return { context: { ...checked, conversation }, conversation, idempotent_replay: false };
  } finally {
    await releaseControlledChatOpenLock(svc, openLock);
  }
}

async function findIdempotentMessage(svc, conversationId, senderType, clientMessageId) {
  const rows = await svc.entities.PatientRequestMessage.filter({
    conversation_id: conversationId,
    sender_type: senderType,
    client_message_id: clientMessageId,
  }, '-created_date', 5);
  return rows[0] || null;
}

async function sendMessage(base44, svc, context, input) {
  const conversation = context.conversation;
  if (!conversation || conversation.status !== 'open') return { error: 'Conversatia nu este deschisa.', status: 409 };
  const eligibility = controlledChatEligibility({
    request: context.request,
    lead: context.lead,
    response: context.response,
    entitlement: context.entitlement,
    contact: context.contact,
    conversation,
  });
  if (!eligibility.eligible) {
    return { error: 'Conversatia nu mai permite mesaje.', status: 409, reasons: eligibility.reasons };
  }

  const validation = validateControlledChatMessage(input.message);
  if (!validation.valid) {
    const contactReason = validation.reasons.some((reason) => ['email_not_allowed', 'phone_not_allowed', 'link_not_allowed'].includes(reason));
    return {
      error: contactReason
        ? 'Nu include telefon, email sau linkuri in chat. Datele de contact se gestioneaza separat.'
        : 'Mesajul trebuie sa aiba intre 2 si 1200 de caractere.',
      status: 400,
      reasons: validation.reasons,
    };
  }
  const clientMessageId = clean(input.client_message_id, 120);
  if (clientMessageId.length < 8) return { error: 'client_message_id nu este valid.', status: 400 };

  const existing = await findIdempotentMessage(svc, conversation.id, context.actor, clientMessageId);
  if (existing) return { message: existing, conversation, idempotent_replay: true };

  const messageLock = await acquireControlledChatMessageLock(svc, conversation.id);
  if (!messageLock) return { error: 'Mesajul este procesat in alta sesiune. Reincearca.', status: 409 };
  try {
    const checked = context.actor === 'patient'
      ? await loadPatientContext(svc, {
        request_id: context.request.id,
        request_access_token: context.accessToken,
        location_id: context.location.id,
      })
      : await loadProviderContext(base44, svc, {
        location_id: context.location.id,
        lead_id: context.lead.id,
      });
    if (checked.error) return checked;
    if (!checked.conversation || checked.conversation.id !== conversation.id || checked.conversation.status !== 'open') {
      return { error: 'Conversatia nu mai este deschisa.', status: 409 };
    }
    const checkedEligibility = controlledChatEligibility({
      request: checked.request,
      lead: checked.lead,
      response: checked.response,
      entitlement: checked.entitlement,
      contact: checked.contact,
      conversation: checked.conversation,
    });
    if (!checkedEligibility.eligible) {
      return { error: 'Conversatia nu mai permite mesaje.', status: 409, reasons: checkedEligibility.reasons };
    }

    const replay = await findIdempotentMessage(svc, conversation.id, context.actor, clientMessageId);
    if (replay) return { message: replay, conversation: checked.conversation, idempotent_replay: true };

    const recentMessages = await svc.entities.PatientRequestMessage.filter({
      conversation_id: conversation.id,
      sender_type: context.actor,
      status: 'active',
    }, '-created_date', 100);
    const rateLimit = controlledChatRateLimitState(recentMessages, context.actor);
    if (!rateLimit.allowed) return { error: 'Ai atins limita de mesaje pentru ultima ora. Reincearca mai tarziu.', status: 429 };

    const now = new Date().toISOString();
    const message = await svc.entities.PatientRequestMessage.create({
      message_contract_version: CONTROLLED_CHAT_MESSAGE_CONTRACT_VERSION,
      conversation_id: conversation.id,
      request_id: checked.lead.request_id,
      lead_id: checked.lead.id,
      organization_id: checked.lead.organization_id || checked.location.organization_id || '',
      location_id: checked.location.id,
      sender_type: context.actor,
      sender_user_id: context.actor === 'provider' ? checked.user.id : '',
      client_message_id: clientMessageId,
      body: validation.body,
      status: 'active',
      sent_at: now,
    });

    const conversationUpdate = context.actor === 'provider'
      ? {
        last_message_at: now,
        provider_last_message_at: now,
        provider_last_read_at: now,
        provider_unread_count: 0,
        patient_unread_count: Math.max(0, Number(checked.conversation.patient_unread_count) || 0) + 1,
      }
      : {
        last_message_at: now,
        patient_last_message_at: now,
        patient_last_read_at: now,
        patient_unread_count: 0,
        provider_unread_count: Math.max(0, Number(checked.conversation.provider_unread_count) || 0) + 1,
      };
    const updatedConversation = await svc.entities.PatientRequestConversation.update(conversation.id, conversationUpdate);
    await svc.entities.ProviderLead.update(checked.lead.id, {
      conversation_access_state: 'available',
      last_conversation_at: now,
    });
    return { message, conversation: updatedConversation, idempotent_replay: false };
  } finally {
    await releaseControlledChatMessageLock(svc, messageLock);
  }
}

async function markRead(svc, context) {
  if (!context.conversation) return { conversation: null };
  const now = new Date().toISOString();
  const update = context.actor === 'provider'
    ? { provider_unread_count: 0, provider_last_read_at: now }
    : { patient_unread_count: 0, patient_last_read_at: now };
  return { conversation: await svc.entities.PatientRequestConversation.update(context.conversation.id, update) };
}

async function closeConversation(svc, context) {
  if (!context.conversation || context.conversation.status !== 'open') {
    return { conversation: context.conversation, idempotent_replay: true };
  }
  const messageLock = await acquireControlledChatMessageLock(svc, context.conversation.id);
  if (!messageLock) return { error: 'Conversatia este actualizata in alta sesiune. Reincearca.', status: 409 };
  try {
    const now = new Date().toISOString();
    const conversation = await svc.entities.PatientRequestConversation.update(context.conversation.id, {
      status: 'closed',
      closed_at: now,
      closed_by: context.actor,
    });
    await svc.entities.ProviderLead.update(context.lead.id, {
      conversation_access_state: 'locked',
      last_conversation_at: now,
    });
    return { conversation, idempotent_replay: false };
  } finally {
    await releaseControlledChatMessageLock(svc, messageLock);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const actor = clean(input.actor, 20);
    const action = clean(input.action || 'status', 40);
    if (!ACTORS.has(actor)) return res({ error: 'Actorul conversatiei nu este valid.' }, 400);
    if (!ACTIONS.has(action)) return res({ error: 'Actiune necunoscuta.' }, 400);

    let context = actor === 'patient'
      ? await loadPatientContext(svc, input)
      : await loadProviderContext(base44, svc, input);
    if (context.error) return res({ error: context.error }, context.status);

    if (actor === 'provider' && !context.entitlement?.feature_keys?.includes('provider_chat.access')) {
      return res({ error: 'Chatul este disponibil in planul Pro.', entitlement: context.entitlement }, 402);
    }
    if (action === 'status') return res(await buildStatusPayload(svc, context));

    if (action === 'open') {
      const opened = await openConversation(svc, context);
      if (opened.error) return res({ error: opened.error, reasons: opened.reasons || [] }, opened.status);
      context = opened.context;
      if (!opened.idempotent_replay) {
        await notifyChatEvent(svc, context, { kind: 'opened', conversation: opened.conversation });
      }
      return res({ ...(await buildStatusPayload(svc, context)), idempotent_replay: opened.idempotent_replay });
    }

    if (action === 'send') {
      const sent = await sendMessage(base44, svc, context, input);
      if (sent.error) return res({ error: sent.error, reasons: sent.reasons || [] }, sent.status);
      context = { ...context, conversation: sent.conversation };
      if (!sent.idempotent_replay) {
        await notifyChatEvent(svc, context, { kind: 'message', message: sent.message });
      }
      return res({
        ...(await buildStatusPayload(svc, context)),
        sent_message: sanitizeControlledChatMessage(sent.message),
        idempotent_replay: sent.idempotent_replay,
      });
    }

    if (action === 'mark_read') {
      const marked = await markRead(svc, context);
      context = { ...context, conversation: marked.conversation };
      return res(await buildStatusPayload(svc, context));
    }

    const closed = await closeConversation(svc, context);
    if (closed.error) return res({ error: closed.error }, closed.status);
    context = { ...context, conversation: closed.conversation };
    if (!closed.idempotent_replay) {
      await notifyChatEvent(svc, context, { kind: 'closed', conversation: closed.conversation });
    }
    return res({ ...(await buildStatusPayload(svc, context)), idempotent_replay: closed.idempotent_replay });
  } catch (_error) {
    return res({ error: 'Conversatia nu a putut fi procesata.' }, 500);
  }
});
