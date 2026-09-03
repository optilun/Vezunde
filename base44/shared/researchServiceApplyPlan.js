// Planificarea aplicarii serviciilor venite din cercetare pe o locatie existenta.
//
// 2026-09-03, audit flow intrebari/recomandari. Directorul avea 500+ locatii publicate si
// 26 de randuri LocationService, toate pe o singura locatie. Potrivirea se face exclusiv
// pe chei de serviciu, deci practic nicio cautare nu avea ce potrivi.
//
// Cauza nu era lipsa datelor, ci o veriga rupta. Modulul de cercetare extrage serviciile
// din sursa, adminul le aproba unul cate unul contra unui fragment de text (review_field
// refuza aprobarea fara source_ref si snippet), iar la final rezultatul era serializat
// intr-un sir de text pus in `source_notes`. Adminul trebuia sa reintroduca fiecare
// serviciu manual.
//
// Fisierul asta contine DOAR decizia, fara nicio scriere, ca sa poata fi testata direct.
// Efectele (LocationService, ProviderEvidence, DirectoryAuditRecord) raman in
// base44/functions/directoryOps/directoryOps.ts, langa add_service, cu care imparte
// acelasi constructor de rand.
//
// Principiul "serviciile nu sunt presupuse" ramane intact: nimic nu se planifica fara o
// decizie de aprobare umana insotita de dovada. Tot ce nu are dovada este BLOCAT, nu
// scris si nu ghicit.
import { normalizeServiceKey } from './canonicalServiceRegistryExtended.js';

export const RESEARCH_SERVICE_APPLY_CONTRACT_VERSION = 'research-service-apply-v1';

// Serviciile venite din cercetare sunt listate public, nu confirmate de furnizor:
// provin dintr-o sursa publica. Furnizorul le poate confirma sau corecta cand isi
// revendica profilul, moment in care trec prin fluxul normal de review.
export const RESEARCH_SERVICE_CONFIRMATION_LEVEL = 'publicly_listed';

function clean(value) {
  return String(value === undefined || value === null ? '' : value).trim();
}

// Compunerea unui rand LocationService si regula prin care intra in potrivire.
//
// 2026-09-03, etapa 2. Amandoua traiau in directoryOps.ts. Cand a aparut si modulul de
// loturi, singurele optiuni erau sa le duplic sau sa le mut aici. Raportul de audit
// aratase deja ce se intampla cu prima varianta: `applyServices` exista in doua exemplare
// aproape identice, in adminServiceConfigurationReview.ts si adminWorkspaceReview.ts, si
// intre timp au divergat (unul scrie cas_reimbursed, celalalt nu). Deci mutare, nu copie.
//
// Logica este identica cu cea de dinainte, doar relocata.
export function computeServiceMatchingAllowed(level, rawKey, location) {
  if (!location || location.active_status === 'inactiva' || location.profile_control_status === 'suspended') return false;
  const normalized = normalizeServiceKey(rawKey);
  const definition = normalized.definition;
  if (!definition) return false;
  return definition.patient_facing !== false
    && definition.b2b_only !== true
    && definition.matching_allowed_when_provider_confirmed
    && ['publicly_listed', 'provider_confirmed', 'vezunde_verified'].includes(level);
}

export function locationServiceRow({ locationId, normalized, level, matchingAllowed, sourceUrl, confirmedAt, notes }) {
  const definition = normalized.definition;
  return {
    location_id: locationId,
    service_key: normalized.canonicalKey,
    service_need_level: definition.service_need_level,
    confirmation_level: level,
    matching_allowed: matchingAllowed,
    is_advanced_service: definition.requires_review || definition.service_need_level === 'specialized_medical',
    service_source_url: sourceUrl,
    service_confirmed_at: confirmedAt,
    notes: notes || '',
    migration_review_required: false,
    is_active: true,
  };
}

export function isPublicHttpUrl(value) {
  return /^https?:\/\//i.test(clean(value));
}

/**
 * @param {{
 *   approvedFields?: Record<string, any>,
 *   reviewDecisions?: Record<string, any>,
 *   existingServiceKeys?: string[],
 *   fallbackSourceUrl?: string,
 *   sourceCheckedAt?: string,
 *   now?: string,
 *   matchingAllowedFor?: (level: string, serviceKey: string) => boolean,
 * }} input
 */
export function planResearchServiceApplication(input = {}) {
  const approved = input.approvedFields && typeof input.approvedFields === 'object' ? input.approvedFields : {};
  const decisions = input.reviewDecisions && typeof input.reviewDecisions === 'object' ? input.reviewDecisions : {};
  const existing = new Set((Array.isArray(input.existingServiceKeys) ? input.existingServiceKeys : [])
    .map((key) => normalizeServiceKey(key).canonicalKey)
    .filter(Boolean));
  const fallbackSourceUrl = clean(input.fallbackSourceUrl);
  const sourceCheckedAt = clean(input.sourceCheckedAt);
  const now = clean(input.now) || new Date().toISOString();
  const matchingAllowedFor = typeof input.matchingAllowedFor === 'function'
    ? input.matchingAllowedFor
    : () => false;

  const planned = [];
  const skipped = [];
  const blocked = [];

  // Ordine stabila: acelasi draft produce mereu acelasi plan, deci si acelasi token de
  // confirmare. Fara asta, un dry run si aplicarea lui ar putea sa nu mai corespunda.
  const fields = Object.keys(approved).filter((field) => field.startsWith('service:')).sort();

  for (const field of fields) {
    const rawKey = clean(approved[field]);
    const decision = decisions[field];
    const normalized = normalizeServiceKey(rawKey);

    if (!decision || decision.decision !== 'approve' || !clean(decision.source_ref) || !clean(decision.snippet)) {
      blocked.push({ service_key: rawKey, reason: 'fara decizie de aprobare cu dovada (source_ref si snippet)' });
      continue;
    }
    if (normalized.status !== 'canonical' || !normalized.definition) {
      blocked.push({ service_key: rawKey, reason: 'in afara catalogului canonic aprobat' });
      continue;
    }
    const sourceUrl = isPublicHttpUrl(decision.source_ref) ? clean(decision.source_ref) : fallbackSourceUrl;
    if (!isPublicHttpUrl(sourceUrl)) {
      blocked.push({
        service_key: normalized.canonicalKey,
        reason: 'sursa nu are un URL public - serviciul nu poate fi listat public',
      });
      continue;
    }
    if (existing.has(normalized.canonicalKey)) {
      skipped.push({ service_key: normalized.canonicalKey, reason: 'exista deja pe locatie' });
      continue;
    }

    planned.push({
      service_key: normalized.canonicalKey,
      label: normalized.definition.label,
      confirmation_level: RESEARCH_SERVICE_CONFIRMATION_LEVEL,
      matching_allowed: matchingAllowedFor(RESEARCH_SERVICE_CONFIRMATION_LEVEL, normalized.canonicalKey) === true,
      service_source_url: sourceUrl,
      service_confirmed_at: clean(decision.at) || sourceCheckedAt || now,
      snippet: clean(decision.snippet).slice(0, 500),
    });
  }

  return { planned, skipped, blocked };
}

// Token-ul de confirmare urmeaza acelasi tipar ca la loturile de import
// ("IMPORT <cheie> <hash> <randuri>"): identifica draftul si numarul exact de randuri
// planificate. Daca planul se schimba intre dry run si aplicare, token-ul nu mai
// corespunde si aplicarea este refuzata.
export function researchServiceApplyConfirmation(draftId, plannedCount) {
  return `SERVICII ${clean(draftId).slice(0, 8)} ${Number(plannedCount) || 0}`;
}

// ---------------------------------------------------------------------------
// Etapa 2: loturi peste mai multe perechi (draft de cercetare, locatie).
//
// Un draft de cercetare descrie un singur furnizor, deci un lot nu are cum sa fie "un
// draft peste multe locatii". Scara reala e invers: adminul recenzeaza multe drafturi si
// vrea sa le aplice pe toate deodata, cu o singura aprobare si cu posibilitatea de a
// retrage tot daca se dovedeste gresit.
// ---------------------------------------------------------------------------

export const RESEARCH_SERVICE_BATCH_CONTRACT_VERSION = 'research-service-batch-v1';

// Cate perechi se proceseaza intr-un singur apel. Executia avanseaza pe cursor, ca la
// loturile de import: un apel lung poate fi intrerupt, iar reluarea nu reia de la zero.
export const RESEARCH_SERVICE_BATCH_CHUNK_SIZE = 5;

export function researchServiceBatchConfirmation(batchKey, plannedCount) {
  return `SERVICII-LOT ${clean(batchKey)} ${Number(plannedCount) || 0}`;
}

export function researchServiceBatchRollbackConfirmation(batchKey, appliedCount) {
  return `ROLLBACK-SERVICII ${clean(batchKey)} ${Number(appliedCount) || 0}`;
}

// Perechile sunt unice si au ordine stabila: acelasi continut produce mereu acelasi plan,
// deci acelasi token de confirmare. Fara asta, doua vizualizari succesive ale aceluiasi
// lot ar putea cere token-uri diferite.
export function normalizeResearchServicePairs(pairs) {
  const seen = new Set();
  const result = [];
  for (const pair of Array.isArray(pairs) ? pairs : []) {
    const draftId = clean(pair?.draft_id);
    const locationId = clean(pair?.location_id);
    if (!draftId || !locationId) continue;
    const key = `${draftId}|${locationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ draft_id: draftId, location_id: locationId });
  }
  return result.sort((a, b) => (
    a.location_id.localeCompare(b.location_id) || a.draft_id.localeCompare(b.draft_id)
  ));
}

/**
 * Aduna planurile per pereche intr-un rezumat de lot.
 * @param {Array<{ draft_id?: string, location_id?: string, planned?: any[], skipped?: any[], blocked?: any[], error?: string }>} pairPlans
 */
export function summarizeResearchServiceBatchPlan(pairPlans) {
  const rows = Array.isArray(pairPlans) ? pairPlans : [];
  let planned = 0;
  let skipped = 0;
  let blocked = 0;
  let failed = 0;
  for (const row of rows) {
    planned += Array.isArray(row?.planned) ? row.planned.length : 0;
    skipped += Array.isArray(row?.skipped) ? row.skipped.length : 0;
    blocked += Array.isArray(row?.blocked) ? row.blocked.length : 0;
    if (clean(row?.error)) failed += 1;
  }
  return {
    pair_count: rows.length,
    planned_count: planned,
    skipped_count: skipped,
    blocked_count: blocked,
    failed_pair_count: failed,
  };
}

// Un rand scris de lot poate fi retras doar daca nimeni nu l-a atins intre timp. Aceeasi
// regula ca la rollback-ul de import: nu se sterge nimic ce a fost modificat dupa scriere.
export function isResearchServiceRowRollbackSafe(row, draftId) {
  if (!row) return false;
  if (clean(row.confirmation_level) !== RESEARCH_SERVICE_CONFIRMATION_LEVEL) return false;
  const expectedPrefix = `Cercetare AI Copilot, draft ${clean(draftId)}`;
  return clean(row.notes).startsWith(expectedPrefix);
}

export function researchServiceRowNote(draftId, snippet) {
  return `Cercetare AI Copilot, draft ${clean(draftId)}. Dovada din sursa: "${clean(snippet)}"`;
}
