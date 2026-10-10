import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getCanonicalServiceDefinition } from '../../shared/canonicalServiceRegistryExtended.js';
import {
  ADMIN_PATIENT_REQUEST_FILTERS,
  adminPatientRequestRow,
  classifyPatientRequestForAdmin,
  matchesAdminPatientRequestFilter,
  summarizeAdminPatientRequests,
} from '../../shared/adminPatientRequestView.js';

// 2026-10-10 (audit trasee -> admin). „Cereri pacienți”: adminul vede fiecare cerere, daca a fost
// trimisa, la cate locatii a ajuns si daca are raspuns. Doar citire si doar admin. Nu intoarce
// nume, email, telefon, adresa sau textul scris de pacient; nu schimba matchingul sau distribuirea.

const REQUEST_LIMIT = 150;
const WINDOW_DAYS = 120;
const RELATED_LIMIT = 3000;

function serviceLabel(key) {
  return getCanonicalServiceDefinition(key)?.label || '';
}

async function relatedByRequest(entity, requestIds) {
  if (!entity?.filter || requestIds.length === 0) return [];
  const rows = await entity.filter({ request_id: { $in: requestIds } }, '-created_date', RELATED_LIMIT).catch(() => null);
  if (rows === null) throw new Error('Datele legate de cereri nu s-au putut citi.');
  return Array.isArray(rows) ? rows : [];
}

async function loadRows(svc) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const requests = await svc.entities.PatientRequest.filter({ created_date: { $gte: since } }, '-created_date', REQUEST_LIMIT);
  const list = (Array.isArray(requests) ? requests : []).filter((request) => request?.persistence_state !== 'creating');
  const ids = list.map((request) => request.id).filter(Boolean);

  const [contacts, leads, responses, recoveries] = await Promise.all([
    relatedByRequest(svc.entities.PatientRequestContact, ids),
    relatedByRequest(svc.entities.ProviderLead, ids),
    relatedByRequest(svc.entities.ProviderLeadResponse, ids),
    relatedByRequest(svc.entities.PatientRequestRecoveryCase, ids),
  ]);

  const consentByRequest = new Map();
  for (const contact of contacts) {
    if (contact?.provider_request_distribution_consent === true) consentByRequest.set(contact.request_id, true);
  }
  const countBy = (rows, keep = () => true) => {
    const counts = new Map();
    for (const row of rows) {
      if (!row?.request_id || !keep(row)) continue;
      counts.set(row.request_id, (counts.get(row.request_id) || 0) + 1);
    }
    return counts;
  };
  const leadCounts = countBy(leads);
  const responseCounts = countBy(responses, (row) => row.status !== 'withdrawn' && !row.withdrawn_at);
  const recoveryByRequest = new Map();
  for (const recovery of recoveries) {
    if (recovery?.request_id && !recoveryByRequest.has(recovery.request_id)) recoveryByRequest.set(recovery.request_id, recovery.status || '');
  }

  return list.map((request) => {
    const recoveryStatus = recoveryByRequest.get(request.id) || '';
    const classification = classifyPatientRequestForAdmin({
      request,
      distributionConsent: consentByRequest.get(request.id) === true,
      leadCount: leadCounts.get(request.id) || 0,
      responseCount: responseCounts.get(request.id) || 0,
      recoveryStatus,
    });
    return adminPatientRequestRow(request, classification, { serviceLabel, recoveryStatus });
  });
}

export async function handle(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Autentificare necesara' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acces interzis: doar administratori' }, { status: 403 });
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || 'list');
    const rows = await loadRows(base44.asServiceRole);
    const summary = summarizeAdminPatientRequests(rows);

    if (action === 'summary') {
      return Response.json({ attention_count: summary.attention, summary, window_days: WINDOW_DAYS });
    }
    if (action === 'list') {
      const filter = ADMIN_PATIENT_REQUEST_FILTERS.includes(payload?.filter) ? payload.filter : 'all';
      return Response.json({
        requests: rows.filter((row) => matchesAdminPatientRequestFilter(row, filter)),
        summary,
        filter,
        window_days: WINDOW_DAYS,
        limit: REQUEST_LIMIT,
      });
    }
    return Response.json({ error: 'Actiune necunoscuta' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message || 'Cererile nu s-au putut incarca' }, { status: 500 });
  }
}
