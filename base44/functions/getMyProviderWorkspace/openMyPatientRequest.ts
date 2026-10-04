import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import {
  createAccountAccessToken,
  nextAccountAccessGrants,
  sha256Hex,
} from '../../shared/patientRequestAccessGrant.js';

// 2026-10-04 (structura conturilor, pasul 5). „Deschide cererea” din „Cererile mele”, fara linkul
// din email. Doar contul care a trimis cererea (`requester_user_id`, pus de server la creare)
// primeste un acces nou, valabil 30 de zile. Linkul din email ramane valabil.
//
// Raspunsul contine tokenul o singura data; in baza de date se pastreaza doar hash-ul lui.

export const OPEN_MY_PATIENT_REQUEST_CONTRACT_VERSION = 'open-my-patient-request-v1';

function clean(value, maxLength = 120) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function retentionExpired(contact, now) {
  const retentionUntil = Date.parse(String(contact?.retention_until || ''));
  return Number.isFinite(retentionUntil) && retentionUntil <= now;
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;
    const input = await req.json().catch(() => ({}));
    const requestId = clean(input.request_id);
    if (!requestId) return Response.json({ error: 'Alege cererea.' }, { status: 400 });

    const request = await svc.entities.PatientRequest.get(requestId).catch(() => null);
    // Acelasi raspuns pentru „nu exista” si „nu e a ta”: nu confirmam existenta cererilor altora.
    if (!request || request.requester_user_id !== user.id || request.persistence_state !== 'complete') {
      return Response.json({ error: 'Cererea nu a fost gasita in contul tau.' }, { status: 404 });
    }

    const now = Date.now();
    const contacts = await svc.entities.PatientRequestContact.filter({ request_id: request.id, status: 'active' }, '-updated_date', 5);
    const contact = contacts.find((row) => row.request_id === request.id && !retentionExpired(row, now));
    if (!contact) return Response.json({ error: 'Cererea nu mai poate fi deschisă: datele ei nu mai sunt păstrate.' }, { status: 410 });

    const accessToken = createAccountAccessToken();
    const tokenHash = await sha256Hex(accessToken);
    const grants = nextAccountAccessGrants(contact, { tokenHash, userId: user.id, now });
    await svc.entities.PatientRequestContact.update(contact.id, { account_access_grants: grants });

    return Response.json({
      contract_version: OPEN_MY_PATIENT_REQUEST_CONTRACT_VERSION,
      request_id: request.id,
      public_reference: clean(request.public_reference),
      access_token: accessToken,
      expires_at: grants[0].expires_at,
    });
  } catch (_error) {
    return Response.json({ error: 'Cererea nu a putut fi deschisă. Încearcă din nou.' }, { status: 500 });
  }
}
