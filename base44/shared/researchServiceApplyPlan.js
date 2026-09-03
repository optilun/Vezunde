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
