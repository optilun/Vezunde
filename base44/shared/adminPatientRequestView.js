// 2026-10-10 (audit trasee -> admin). Starea unei cereri de pacient, asa cum o vede adminul in
// „Cereri pacienți”. Doar citire: nu schimba cererea, matchingul, Top 3 sau distribuirea.
//
// Stari (in ordinea in care se verifica):
//   closed          cererea e rezolvata / inchisa / expirata
//   no_results      nu a avut nicio potrivire (match_count = 0)
//   undelivered     pacientul a cerut trimiterea, dar nicio locatie n-a primit-o (0 lead-uri)
//   not_sent        salvata, pacientul n-a cerut (inca) trimiterea catre locatii
//   answered        cel putin un raspuns de la o locatie
//   waiting         trimisa la locatii, inca fara raspuns
// `attention` = cererea asteapta ceva de la echipa: no_results / undelivered fara un caz de
// recuperare deja deschis (acelea apar in Coada de verificare › Cereri fara rezultate).

export const ADMIN_PATIENT_REQUEST_STATES = Object.freeze({
  undelivered: { label: 'N-a ajuns la nicio locație', tone: 'danger' },
  no_results: { label: 'Fără rezultate', tone: 'danger' },
  not_sent: { label: 'Salvată, netrimisă', tone: 'muted' },
  waiting: { label: 'Trimisă, fără răspuns', tone: 'warning' },
  answered: { label: 'Cu răspuns', tone: 'success' },
  closed: { label: 'Închisă', tone: 'muted' },
});

export const ADMIN_PATIENT_REQUEST_FILTERS = Object.freeze(['attention', 'all', 'not_sent', 'waiting', 'answered', 'closed']);

const ACTIVE_RECOVERY = new Set(['queued', 'in_review']);
const CLOSED_LIFECYCLE = new Set(['resolved', 'closed', 'expired']);
const CLOSED_STATUS = new Set(['inchisa', 'expirata', 'retrasa']);

export function classifyPatientRequestForAdmin({
  request = {},
  distributionConsent = false,
  leadCount = 0,
  responseCount = 0,
  recoveryStatus = '',
} = {}) {
  const leads = Math.max(0, Number(leadCount) || 0);
  const responses = Math.max(0, Number(responseCount) || 0);
  const matches = Math.max(0, Number(request.match_count) || 0);
  let state;
  if (CLOSED_LIFECYCLE.has(request.lifecycle_state) || CLOSED_STATUS.has(request.status)) state = 'closed';
  else if (matches === 0) state = 'no_results';
  else if (distributionConsent === true && leads === 0) state = 'undelivered';
  else if (leads === 0) state = 'not_sent';
  else if (responses > 0) state = 'answered';
  else state = 'waiting';
  const recoveryOpen = ACTIVE_RECOVERY.has(String(recoveryStatus || ''));
  const attention = (state === 'undelivered' || state === 'no_results') && !recoveryOpen;
  return { state, attention, recovery_open: recoveryOpen, lead_count: leads, response_count: responses };
}

export function matchesAdminPatientRequestFilter(row, filter = 'attention') {
  if (filter === 'all') return true;
  if (filter === 'attention') return row?.attention === true;
  return row?.state === filter;
}

// Un rand pentru ecranul de admin: fara nume, email, telefon, adresa sau textul scris de pacient.
export function adminPatientRequestRow(request = {}, classification = {}, { serviceLabel = (key) => key, recoveryStatus = '' } = {}) {
  const serviceKeys = Array.isArray(request.service_keys) ? request.service_keys : [];
  const flags = Array.isArray(request.possible_safety_flags) ? request.possible_safety_flags.filter(Boolean) : [];
  return {
    id: request.id,
    public_reference: request.public_reference || '',
    created_date: request.submitted_at || request.created_date || null,
    city: request.city || '',
    county: request.county || '',
    services: [...new Set(serviceKeys.map((key) => serviceLabel(key)).filter(Boolean))].slice(0, 6),
    urgency: request.urgency === 'urgenta' ? 'urgenta' : 'normala',
    has_safety_flags: flags.length > 0,
    match_count: Math.max(0, Number(request.match_count) || 0),
    top3_count: Math.max(0, Number(request.top3_count) || 0),
    lifecycle_stage: request.lifecycle_stage || '',
    recovery_status: recoveryStatus || '',
    ...classification,
  };
}

export function summarizeAdminPatientRequests(rows = []) {
  const summary = { total: 0, attention: 0, undelivered: 0, no_results: 0, not_sent: 0, waiting: 0, answered: 0, closed: 0 };
  for (const row of Array.isArray(rows) ? rows : []) {
    summary.total += 1;
    if (row.attention) summary.attention += 1;
    if (summary[row.state] !== undefined) summary[row.state] += 1;
  }
  return summary;
}
