import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  PATIENT_REQUEST_STATUS_CONTRACT_VERSION,
  sanitizePatientProviderResponse,
  sanitizePatientRequestStatus,
} from '../../../shared/patientRequestStatusPolicy.js';
import { maskPatientEmail } from '../../../shared/patientEmailVerificationPolicy.js';

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const requestId = clean(input.request_id, 120);
    const accessToken = clean(input.request_access_token, 160);
    if (!requestId || !accessToken) return res({ error: 'request_id si tokenul de acces sunt obligatorii.' }, 400);

    const authorized = await authorizeRequest(svc, requestId, accessToken);
    if (authorized.error) return res({ error: authorized.error }, authorized.status);

    const [rows, approvalRows] = await Promise.all([
      svc.entities.ProviderLeadResponse.filter({ request_id: requestId, status: 'active' }, '-updated_date', 100),
      svc.entities.ContactShareApproval.filter({ request_id: requestId }, '-updated_date', 100),
    ]);
    const approvalByLocation = new Map();
    for (const approval of approvalRows) {
      if (!approval.location_id || approvalByLocation.has(approval.location_id)) continue;
      approvalByLocation.set(approval.location_id, approval);
    }

    const responses = [];
    const seenLocations = new Set();
    for (const row of rows) {
      if (!row.location_id || seenLocations.has(row.location_id)) continue;
      const location = await svc.entities.ProviderLocation.get(row.location_id).catch(() => null);
      if (!location) continue;
      seenLocations.add(row.location_id);
      responses.push(sanitizePatientProviderResponse(row, location, approvalByLocation.get(row.location_id) || null));
    }

    return res({
      contract_version: PATIENT_REQUEST_STATUS_CONTRACT_VERSION,
      request: sanitizePatientRequestStatus(authorized.request),
      response_count: responses.length,
      responses,
      contact_email_verified: authorized.contact.contact_email_verified === true,
      contact_email_masked: maskPatientEmail(authorized.contact.contact_email),
      contact_phone_available: Boolean(clean(authorized.contact.contact_phone, 32)),
      phone_sharing_enabled: responses.some((response) => response.contact_share_status === 'approved'),
      contact_sharing_enabled: responses.some((response) => response.contact_share_status === 'approved'),
      conversation_enabled: false,
    });
  } catch (_error) {
    return res({ error: 'Statusul cererii nu a putut fi incarcat.' }, 500);
  }
});
