import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { sanitizePatientRequestStatus } from '../../shared/patientRequestStatusPolicy.js';
import { patientIntentLabel } from '../../shared/providerLeadEligibility.js';
import { filterByIdList, groupRowsBy, rowsFor } from '../../shared/providerWorkspaceBatchQueries.js';

// 2026-10-03. Contul personal este contul de pacient (decizie Alex, structura conturilor, pasul 1).
// „Cererile mele” arata acum cererile trimise ca pacient, nu revendicarile de organizatii (acelea
// stau in grupul Organizatii). Inainte, un pacient logat nu avea nicio lista a cererilor lui: le
// gasea doar prin linkul securizat al fiecarei cereri.
//
// Doar citire: cererile cu `requester_user_id` = contul curent, complet salvate, plus cate locatii
// au raspuns. Nu intoarce tokenul de acces, datele de contact sau mesajele - acelea raman in pagina
// cererii, deschisa cu linkul securizat.

export const MY_PATIENT_REQUESTS_CONTRACT_VERSION = 'my-patient-requests-v1';
const MAX_REQUESTS = 50;

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    const svc = base44.asServiceRole;

    const rows = await svc.entities.PatientRequest.filter({
      requester_user_id: user.id,
      persistence_state: 'complete',
    }, '-created_date', MAX_REQUESTS);
    const requests = rows.filter((request) => request.requester_user_id === user.id);

    const responses = await filterByIdList(
      svc.entities.ProviderLeadResponse,
      'request_id',
      requests.map((request) => request.id),
      { status: 'active' },
      { sort: '-updated_date' },
    );
    const responsesByRequest = groupRowsBy(responses, 'request_id');

    return Response.json({
      contract_version: MY_PATIENT_REQUESTS_CONTRACT_VERSION,
      requests: requests.map((request) => ({
        ...sanitizePatientRequestStatus(request),
        intent_label: patientIntentLabel(request.intent),
        created_date: request.created_date || null,
        response_count: new Set(rowsFor(responsesByRequest, request.id).map((row) => row.location_id).filter(Boolean)).size,
      })),
      truncated: rows.length >= MAX_REQUESTS,
    });
  } catch (_error) {
    return Response.json({ error: 'Cererile nu au putut fi incarcate.' }, { status: 500 });
  }
}
