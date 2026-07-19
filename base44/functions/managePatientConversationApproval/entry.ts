import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PATIENT_CONVERSATION_APPROVAL_CONTRACT_VERSION,
  PROVIDER_CONVERSATION_CONTRACT_VERSION,
  canApprovePatientConversation,
  sanitizePatientConversationApproval,
} from '../../../shared/patientConversationApprovalPolicy.js';
import {
  acquireContactShareApprovalLock,
  releaseContactShareApprovalLock,
} from '../../../shared/contactShareApprovalLock.js';

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

async function authorizeRequest(svc, requestId, accessToken) {
  const request = await svc.entities.PatientRequest.get(requestId).catch(() => null);
  if (!request) return { error: 'Cererea nu a fost gasita.', status: 404 };
  const tokenHash = await sha256(accessToken);
  const contacts = await svc.entities.PatientRequestContact.filter({
    request_id: requestId,
    access_token_hash: tokenHash,
    status: 'active',
  }, null, 2);
  const contact = contacts[0];
  if (!contact) return { error: 'Accesul la cerere nu este valid.', status: 403 };
  return { request, contact };
}

async function findLead(svc, requestId, locationId) {
  const rows = await svc.entities.ProviderLead.filter({
    request_id: requestId,
    location_id: locationId,
  }, '-created_date', 10);
  return rows[0] || null;
}

async function findActiveResponse(svc, requestId, locationId) {
  const rows = await svc.entities.ProviderLeadResponse.filter({
    request_id: requestId,
    location_id: locationId,
    status: 'active',
  }, '-updated_date', 10);
  return rows[0] || null;
}

async function findLatestApproval(svc, requestId, locationId) {
  const rows = await svc.entities.PatientConversationApproval.filter({
    request_id: requestId,
    location_id: locationId,
  }, '-updated_date', 20);
  return rows[0] || null;
}

async function findActiveConversation(svc, requestId, locationId) {
  const rows = await svc.entities.ProviderConversation.filter({
    request_id: requestId,
    location_id: locationId,
    status: 'active',
  }, '-updated_date', 20);
  return rows[0] || null;
}

function leadAllowsConversation(lead) {
  if (!lead || lead.delivery_state !== 'available') return false;
  if (['declined', 'closed', 'expired'].includes(lead.status)) return false;
  const expiresAt = Date.parse(String(lead.expires_at || ''));
  return !Number.isFinite(expiresAt) || expiresAt > Date.now();
}

async function rollbackConversationStart(svc, approval, conversation) {
  const now = new Date().toISOString();
  await Promise.all([
    conversation
      ? svc.entities.ProviderConversation.update(conversation.id, {
        status: 'revoked',
        revoked_at: now,
        close_reason: 'conversation_start_failed',
      }).catch(() => null)
      : Promise.resolve(null),
    approval
      ? svc.entities.PatientConversationApproval.update(approval.id, {
        status: 'revoked',
        revoked_at: now,
      }).catch(() => null)
      : Promise.resolve(null),
  ]);
}

async function approve(svc, request, contact, locationId) {
  if (contact?.contact_email_verified !== true) {
    return { error: 'Confirma mai intai adresa de email asociata cererii.', status: 409 };
  }
  const lead = await findLead(svc, request.id, locationId);
  if (!leadAllowsConversation(lead)) {
    return { error: 'Locatia nu mai poate deschide o conversatie pentru aceasta cerere.', status: 409 };
  }
  const response = await findActiveResponse(svc, request.id, locationId);
  if (!canApprovePatientConversation(response)) {
    return { error: 'Locatia trebuie sa confirme mai intai ca poate ajuta sau ca are nevoie de detalii.', status: 409 };
  }

  const lock = await acquireContactShareApprovalLock(svc, lead.id);
  if (!lock) return { error: 'Acordul este actualizat in alta sesiune. Reincearca.', status: 409 };
  try {
    const [checkedLead, checkedResponse, checkedContact, latestApproval, activeConversation] = await Promise.all([
      findLead(svc, request.id, locationId),
      findActiveResponse(svc, request.id, locationId),
      svc.entities.PatientRequestContact.get(contact.id).catch(() => null),
      findLatestApproval(svc, request.id, locationId),
      findActiveConversation(svc, request.id, locationId),
    ]);
    if (!checkedContact || checkedContact.status !== 'active' || checkedContact.contact_email_verified !== true) {
      return { error: 'Adresa de email nu mai este confirmata.', status: 409 };
    }
    if (!checkedLead || checkedLead.id !== lead.id || !leadAllowsConversation(checkedLead)) {
      return { error: 'Locatia nu mai poate deschide o conversatie pentru aceasta cerere.', status: 409 };
    }
    if (!canApprovePatientConversation(checkedResponse)) {
      return { error: 'Raspunsul locatiei nu mai permite deschiderea conversatiei.', status: 409 };
    }

    if (latestApproval?.status === 'approved' && activeConversation) {
      if (checkedLead.conversation_access_state !== 'available') {
        await svc.entities.ProviderLead.update(checkedLead.id, { conversation_access_state: 'available' });
      }
      return {
        approval: sanitizePatientConversationApproval(latestApproval, activeConversation, locationId),
        conversation_access_state: 'available',
        idempotent_replay: true,
      };
    }

    if (activeConversation) {
      await svc.entities.ProviderConversation.update(activeConversation.id, {
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        close_reason: 'approval_history_repaired',
      });
    }

    const now = new Date().toISOString();
    const approval = await svc.entities.PatientConversationApproval.create({
      request_id: request.id,
      lead_id: checkedLead.id,
      provider_response_id: checkedResponse.id,
      organization_id: checkedLead.organization_id || '',
      location_id: locationId,
      approval_contract_version: PATIENT_CONVERSATION_APPROVAL_CONTRACT_VERSION,
      status: 'approved',
      approved_at: now,
      consent_source: 'patient_request_status',
    });

    let conversation = null;
    try {
      conversation = await svc.entities.ProviderConversation.create({
        request_id: request.id,
        lead_id: checkedLead.id,
        organization_id: checkedLead.organization_id || '',
        location_id: locationId,
        patient_approval_id: approval.id,
        provider_response_id: checkedResponse.id,
        conversation_contract_version: PROVIDER_CONVERSATION_CONTRACT_VERSION,
        status: 'active',
        started_at: now,
      });
      await svc.entities.ProviderLead.update(checkedLead.id, {
        conversation_access_state: 'available',
      });
    } catch (startError) {
      await rollbackConversationStart(svc, approval, conversation);
      throw startError;
    }

    return {
      approval: sanitizePatientConversationApproval(approval, conversation, locationId),
      conversation_access_state: 'available',
      idempotent_replay: false,
    };
  } finally {
    await releaseContactShareApprovalLock(svc, lock);
  }
}

async function revoke(svc, request, locationId) {
  const lead = await findLead(svc, request.id, locationId);
  const lock = lead ? await acquireContactShareApprovalLock(svc, lead.id) : null;
  if (lead && !lock) return { error: 'Acordul este actualizat in alta sesiune. Reincearca.', status: 409 };
  try {
    const [latestApproval, activeConversations] = await Promise.all([
      findLatestApproval(svc, request.id, locationId),
      svc.entities.ProviderConversation.filter({
        request_id: request.id,
        location_id: locationId,
        status: 'active',
      }, '-updated_date', 50),
    ]);
    const now = new Date().toISOString();
    const approval = latestApproval?.status === 'approved'
      ? await svc.entities.PatientConversationApproval.update(latestApproval.id, {
        status: 'revoked',
        revoked_at: now,
      })
      : latestApproval;

    await Promise.all(activeConversations.map((conversation) => svc.entities.ProviderConversation.update(conversation.id, {
      status: 'revoked',
      revoked_at: now,
      close_reason: 'patient_revoked',
    })));
    if (lead) {
      await svc.entities.ProviderLead.update(lead.id, {
        conversation_access_state: 'locked',
      });
    }

    return {
      approval: sanitizePatientConversationApproval(
        approval || { location_id: locationId, status: 'revoked', revoked_at: now },
        null,
        locationId,
      ),
      conversation_access_state: 'locked',
      idempotent_replay: latestApproval?.status !== 'approved' && activeConversations.length === 0,
    };
  } finally {
    if (lock) await releaseContactShareApprovalLock(svc, lock);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const action = clean(input.action || 'list', 40);
    const requestId = clean(input.request_id, 120);
    const accessToken = clean(input.request_access_token, 160);
    const locationId = clean(input.location_id, 120);
    if (!requestId || !accessToken) return res({ error: 'request_id si tokenul de acces sunt obligatorii.' }, 400);

    const authorized = await authorizeRequest(svc, requestId, accessToken);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    if (action === 'list') {
      const [approvalRows, conversationRows] = await Promise.all([
        svc.entities.PatientConversationApproval.filter({ request_id: requestId }, '-updated_date', 200),
        svc.entities.ProviderConversation.filter({ request_id: requestId }, '-updated_date', 200),
      ]);
      const latestApprovalByLocation = new Map();
      const activeConversationByLocation = new Map();
      for (const approval of approvalRows) {
        if (!approval.location_id || latestApprovalByLocation.has(approval.location_id)) continue;
        latestApprovalByLocation.set(approval.location_id, approval);
      }
      for (const conversation of conversationRows) {
        if (conversation.status !== 'active' || !conversation.location_id || activeConversationByLocation.has(conversation.location_id)) continue;
        activeConversationByLocation.set(conversation.location_id, conversation);
      }
      return res({
        contract_version: PATIENT_CONVERSATION_APPROVAL_CONTRACT_VERSION,
        approvals: [...latestApprovalByLocation.entries()].map(([approvedLocationId, approval]) => (
          sanitizePatientConversationApproval(
            approval,
            activeConversationByLocation.get(approvedLocationId) || null,
            approvedLocationId,
          )
        )),
      });
    }

    if (!locationId) return res({ error: 'location_id este obligatoriu.' }, 400);
    if (action === 'approve') {
      const result = await approve(svc, authorized.request, authorized.contact, locationId);
      if (result.error) return res({ error: result.error }, result.status);
      return res({ contract_version: PATIENT_CONVERSATION_APPROVAL_CONTRACT_VERSION, ...result });
    }
    if (action === 'revoke') {
      const result = await revoke(svc, authorized.request, locationId);
      if (result.error) return res({ error: result.error }, result.status);
      return res({ contract_version: PATIENT_CONVERSATION_APPROVAL_CONTRACT_VERSION, ...result });
    }
    return res({ error: 'Actiune necunoscuta.' }, 400);
  } catch (_error) {
    return res({ error: 'Acordul pentru conversatie nu a putut fi actualizat.' }, 500);
  }
});
