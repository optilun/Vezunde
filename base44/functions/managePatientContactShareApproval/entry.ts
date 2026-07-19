import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  CONTACT_SHARE_ALLOWED_FIELDS,
  CONTACT_SHARE_APPROVAL_CONTRACT_VERSION,
  canApproveContactShareForResponse,
  sanitizeContactShareApproval,
} from '../../../shared/contactShareApprovalPolicy.js';
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
  if (!contacts[0]) return { error: 'Accesul la cerere nu este valid.', status: 403 };
  return { request };
}

async function findLead(svc, requestId, locationId) {
  const rows = await svc.entities.ProviderLead.filter({
    request_id: requestId,
    location_id: locationId,
  }, '-created_date', 10);
  return rows[0] || null;
}

async function findApproval(svc, requestId, locationId) {
  const rows = await svc.entities.ContactShareApproval.filter({
    request_id: requestId,
    location_id: locationId,
  }, '-updated_date', 10);
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

function leadAllowsContactApproval(lead) {
  return Boolean(lead)
    && lead.delivery_state === 'available'
    && !['declined', 'closed', 'expired'].includes(lead.status);
}

async function approve(svc, request, locationId) {
  const lead = await findLead(svc, request.id, locationId);
  if (!leadAllowsContactApproval(lead)) {
    return { error: 'Locatia nu mai poate primi acces la contact pentru aceasta cerere.', status: 409 };
  }
  const response = await findActiveResponse(svc, request.id, locationId);
  if (!canApproveContactShareForResponse(response)) {
    return { error: 'Locatia trebuie sa confirme mai intai ca poate ajuta sau ca are nevoie de detalii.', status: 409 };
  }

  const lock = await acquireContactShareApprovalLock(svc, lead.id);
  if (!lock) return { error: 'Acordul este actualizat in alta sesiune. Reincearca.', status: 409 };
  try {
    const [checkedLead, checkedResponse] = await Promise.all([
      findLead(svc, request.id, locationId),
      findActiveResponse(svc, request.id, locationId),
    ]);
    if (!checkedLead || checkedLead.id !== lead.id || !leadAllowsContactApproval(checkedLead)) {
      return { error: 'Locatia nu mai poate primi acces la contact pentru aceasta cerere.', status: 409 };
    }
    if (!canApproveContactShareForResponse(checkedResponse)) {
      return { error: 'Raspunsul locatiei nu mai permite distribuirea contactului.', status: 409 };
    }
    const existing = await findApproval(svc, request.id, locationId);
    const now = new Date().toISOString();
    const payload = {
      request_id: request.id,
      lead_id: checkedLead.id,
      provider_response_id: checkedResponse.id,
      organization_id: checkedLead.organization_id || '',
      location_id: locationId,
      approval_contract_version: CONTACT_SHARE_APPROVAL_CONTRACT_VERSION,
      status: 'approved',
      allowed_contact_fields: [...CONTACT_SHARE_ALLOWED_FIELDS],
      approved_at: now,
      consent_source: 'patient_request_status',
    };
    const approval = existing?.status === 'approved'
      ? await svc.entities.ContactShareApproval.update(existing.id, payload)
      : await svc.entities.ContactShareApproval.create(payload);
    await svc.entities.ProviderLead.update(checkedLead.id, {
      contact_access_state: 'patient_approved',
      conversation_access_state: 'locked',
      last_contact_approval_at: now,
    });
    return {
      approval: sanitizeContactShareApproval(approval, locationId),
      contact_access_state: 'patient_approved',
      conversation_access_state: 'locked',
    };
  } finally {
    await releaseContactShareApprovalLock(svc, lock);
  }
}

async function revoke(svc, request, locationId) {
  const approval = await findApproval(svc, request.id, locationId);
  if (!approval || approval.status !== 'approved') {
    return {
      approval: sanitizeContactShareApproval({ location_id: locationId, status: 'revoked' }, locationId),
      contact_access_state: 'revoked',
      conversation_access_state: 'locked',
      idempotent_replay: true,
    };
  }

  const lead = await findLead(svc, request.id, locationId);
  const lock = lead ? await acquireContactShareApprovalLock(svc, lead.id) : null;
  if (lead && !lock) return { error: 'Acordul este actualizat in alta sesiune. Reincearca.', status: 409 };
  try {
    const now = new Date().toISOString();
    const updated = await svc.entities.ContactShareApproval.update(approval.id, {
      status: 'revoked',
      allowed_contact_fields: [],
      revoked_at: now,
    });
    if (lead) {
      await svc.entities.ProviderLead.update(lead.id, {
        contact_access_state: 'revoked',
        conversation_access_state: 'locked',
        last_contact_approval_at: now,
      });
    }
    return {
      approval: sanitizeContactShareApproval(updated, locationId),
      contact_access_state: 'revoked',
      conversation_access_state: 'locked',
      idempotent_replay: false,
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
      const rows = await svc.entities.ContactShareApproval.filter({ request_id: requestId }, '-updated_date', 100);
      return res({
        contract_version: CONTACT_SHARE_APPROVAL_CONTRACT_VERSION,
        approvals: rows.map((row) => sanitizeContactShareApproval(row)),
      });
    }

    if (!locationId) return res({ error: 'location_id este obligatoriu.' }, 400);
    if (action === 'approve') {
      const result = await approve(svc, authorized.request, locationId);
      if (result.error) return res({ error: result.error }, result.status);
      return res({ contract_version: CONTACT_SHARE_APPROVAL_CONTRACT_VERSION, ...result });
    }
    if (action === 'revoke') {
      const result = await revoke(svc, authorized.request, locationId);
      if (result.error) return res({ error: result.error }, result.status);
      return res({ contract_version: CONTACT_SHARE_APPROVAL_CONTRACT_VERSION, ...result });
    }
    return res({ error: 'Actiune necunoscuta.' }, 400);
  } catch (_error) {
    return res({ error: 'Acordul pentru contact nu a putut fi actualizat.' }, 500);
  }
});
