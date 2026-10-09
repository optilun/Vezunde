import { getCanonicalServiceDefinition, normalizeServiceKey } from './canonicalServiceRegistry.js';
import { canAccessProviderLeadInbox } from './providerLeadInboxPolicy.js';
import { loadRowsForLocationIds } from './locationScopedEntityQuery.js';
import { locationHasActiveLeadMember } from './providerRequestIntake.js';

// 2026-10-09 (audit Top 3, T4 + T5; Alex: „Începe”, după recomandarea din research).
// O singură regulă „poate primi cererea”, folosită în trei locuri:
//   1. la alegerea Top 3 (matchProvidersSemantic, matchProviders) — T4;
//   2. la salvarea cererii, ca serverul să nu mai creadă clasamentul trimis din browser — T5;
//   3. la trimitere rămâne evaluateProviderLeadEligibility + membru activ (aceleași condiții).
// Ordinea dintre locații NU se schimbă: Top 3 = primele trei, în ordinea de azi, care pot primi
// cererea. Planul plătit nu intră nicăieri aici.

export const REQUEST_READY_POLICY_VERSION = 'request-ready-top3-v1';
export const TOP3_LIMIT = 3;

const READY_CONFIRMATION_LEVELS = new Set(['provider_confirmed', 'vezunde_verified']);
const SPECIALIZED_CONFIRMATION_LEVELS = new Set(['vezunde_verified']);
const NEED_ORDER = Object.freeze({ general: 0, technical: 1, specialized_medical: 2 });

function clean(value, maxLength = 160) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function activeRow(row) {
  const status = clean(row?.active_status).toLowerCase();
  return Boolean(row)
    && row.is_active !== false
    && !['inactiv', 'inactiva', 'inactive'].includes(status);
}

export function canonicalServiceKey(value) {
  return normalizeServiceKey(value)?.canonicalKey || '';
}

// Nivelul nevoii calculat pe server din cheile de serviciu (nu luat din browser).
export function serverNeedLevel(serviceKeys) {
  let result = '';
  for (const key of Array.isArray(serviceKeys) ? serviceKeys : []) {
    const level = getCanonicalServiceDefinition(key)?.service_need_level;
    if (!(level in NEED_ORDER)) continue;
    if (!result || NEED_ORDER[level] > NEED_ORDER[result]) result = level;
  }
  return result;
}

// Dintre două niveluri cunoscute îl păstrează pe cel mai strict.
export function stricterNeedLevel(...levels) {
  let result = '';
  for (const level of levels) {
    if (!(level in NEED_ORDER)) continue;
    if (!result || NEED_ORDER[level] > NEED_ORDER[result]) result = level;
  }
  return result;
}

export function isRequestIntakeOn(location) {
  return location?.request_intake_status === 'active' && location?.accepts_patients_directly === true;
}

// Serviciile cerute pe care locația le-a confirmat și le deschide pentru cereri. Cheile se compară
// normalizate, ca la potrivire.
export function requestReadyServiceKeys(services, requestedKeys, needLevel = '') {
  const requested = new Set((Array.isArray(requestedKeys) ? requestedKeys : []).map(canonicalServiceKey).filter(Boolean));
  const allowed = needLevel === 'specialized_medical' ? SPECIALIZED_CONFIRMATION_LEVELS : READY_CONFIRMATION_LEVELS;
  const keys = new Set();
  for (const row of Array.isArray(services) ? services : []) {
    if (!activeRow(row)
      || row.accepts_requests === false
      || row.matching_allowed !== true
      || row.migration_review_required === true
      || !allowed.has(clean(row.confirmation_level))) continue;
    const key = canonicalServiceKey(row.service_key);
    if (key && requested.has(key)) keys.add(key);
  }
  return [...keys];
}

export function evaluateRequestReadiness({ location, services = [], requestedKeys = [], needLevel = '', hasActiveMember = false } = {}) {
  const reasons = [];
  const control = clean(location?.profile_control_status);
  if (!['claimed', 'verified'].includes(control)) reasons.push('profile_not_controlled');
  else if (needLevel === 'specialized_medical' && control !== 'verified') reasons.push('specialized_requires_verified_profile');
  if (location?.status !== 'publicata' || !activeRow(location)) reasons.push('location_not_published');
  if (!isRequestIntakeOn(location)) reasons.push('request_intake_off');
  const readyKeys = requestReadyServiceKeys(services, requestedKeys, needLevel);
  if (readyKeys.length === 0) reasons.push('no_request_ready_service');
  if (hasActiveMember !== true) reasons.push('no_active_member');
  return { ready: reasons.length === 0, reasons, ready_service_keys: readyKeys };
}

// Locațiile care au cel puțin un membru direct cu acces la Cereri (pentru verificarea în lot din
// căutare). Pentru celelalte, apelantul poate verifica separat acoperirea prin proprietarul
// organizației (locationHasActiveLeadMember).
export function locationIdsWithDirectLeadMember(memberships) {
  const ids = new Set();
  for (const row of Array.isArray(memberships) ? memberships : []) {
    if (row?.status !== 'active' || !clean(row?.user_id) || !clean(row?.location_id)) continue;
    if (canAccessProviderLeadInbox(row.role)) ids.add(clean(row.location_id, 120));
  }
  return ids;
}

// T4. Primește lista deja ordonată și etichetată de assignRecommendationBuckets (toate rezultatele,
// fără tăiere) și mută doar eticheta „top3”: primele trei locații confirmate care pot primi cererea
// (`accepts_requests_via_viasee === true`), în ordinea existentă. Celelalte confirmate rămân
// „extended_confirmed”, în aceeași ordine. Lista vizibilă: Top 3, restul confirmatelor, director.
export function assignRequestReadyTop3(orderedEntries, limit = 20) {
  const entries = Array.isArray(orderedEntries) ? orderedEntries : [];
  const confirmed = entries.filter((entry) => entry?.recommendation_group === 'confirmed');
  const others = entries.filter((entry) => entry?.recommendation_group !== 'confirmed');
  const top3 = confirmed.filter((entry) => entry.accepts_requests_via_viasee === true).slice(0, TOP3_LIMIT);
  const top3Ids = new Set(top3.map((entry) => entry.id));
  const rest = confirmed.filter((entry) => !top3Ids.has(entry.id));
  const relabeled = [
    ...top3.map((entry, index) => ({
      ...entry,
      result_bucket: 'top3',
      bucket_rank: index + 1,
      is_top3_eligible: true,
    })),
    ...rest.map((entry, index) => ({
      ...entry,
      result_bucket: 'extended_confirmed',
      bucket_rank: index + 1,
      is_top3_eligible: entry.accepts_requests_via_viasee === true,
    })),
    ...others,
  ];
  return relabeled.slice(0, Math.max(1, Number(limit) || 20));
}

// Evaluează în lot candidații `{ location, services, requestedKeys }` și întoarce
// Map(location_id -> rezultatul evaluateRequestReadiness). Membrii direcți se citesc într-o singură
// interogare; acoperirea prin proprietarul organizației se verifică doar pentru locațiile cărora
// le lipsește numai membrul.
export async function loadRequestReadiness(svc, candidates, needLevel = '') {
  const list = (Array.isArray(candidates) ? candidates : []).filter((item) => item?.location?.id);
  const readiness = new Map();
  if (list.length === 0) return readiness;
  const memberships = await loadRowsForLocationIds(
    svc.entities.ProviderMembership,
    list.map((item) => item.location.id),
    { query: { status: 'active' }, perLocationLimit: 50 },
  ).catch(() => []);
  const withDirectMember = locationIdsWithDirectLeadMember(memberships);
  for (const item of list) {
    let result = evaluateRequestReadiness({
      location: item.location,
      services: item.services,
      requestedKeys: item.requestedKeys,
      needLevel,
      hasActiveMember: withDirectMember.has(item.location.id),
    });
    if (!result.ready && result.reasons.length === 1 && result.reasons[0] === 'no_active_member') {
      const covered = await locationHasActiveLeadMember(svc, item.location).catch(() => false);
      if (covered) result = { ...result, ready: true, reasons: [] };
    }
    readiness.set(item.location.id, result);
  }
  return readiness;
}
