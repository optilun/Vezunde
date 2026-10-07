import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MAX_DAYS, buckets, inPreviousWindow, inWindow, sumBy } from "./analyticsWindow";

// Toate cifrele se calculeaza pe server (count / aggregate). Un apel esuat
// intoarce null, iar interfata il arata ca "indisponibil", nu ca zero.
// O singura incarcare pentru toate perioadele; tinuta 5 minute in memorie, cu buton de actualizare.
// 2026-10-07: un aggregate taiat de limita de randuri se marcheaza (`truncated`), ca cifrele partiale sa nu
// treaca drept complete.
const count = (entity, query) => entity.count(query).catch(() => null);
const aggregate = (entity, params) => entity.aggregate(params)
  .then((r) => ({ rows: r.rows || [], truncated: Boolean(r.truncated) }))
  .catch(() => null);
const PERIODS = [7, 30, 90];
const TTL_MS = 5 * 60 * 1000;
let cache = null;

async function loadBase() {
  const e = base44.entities;
  const since = (d) => ({ created_date: { $gte: new Date(Date.now() - d * 86400000).toISOString() } });
  const daily = { field: "created_date", unit: "day" };
  const [stages, responses, proActive, trust, unconfirmedServices, approxMap, proNew, claimsApproved] = await Promise.all([
    aggregate(e.PatientRequest, { query: since(MAX_DAYS), groupBy: "lifecycle_stage", dateBucket: daily, limit: 1000 }),
    aggregate(e.ProviderLeadResponse, { query: since(MAX_DAYS), groupBy: "response_type", dateBucket: daily, limit: 1000 }),
    count(e.ProviderSubscription, { plan_code: "pro", status: { $in: ["active", "trialing", "grace_period"] } }),
    Promise.all(["directory", "claimed", "verified", "suspended"].map((s) => count(e.ProviderLocation, { status: "publicata", profile_control_status: s }))),
    count(e.LocationService, { confirmation_level: "not_confirmed" }),
    count(e.ProviderLocation, { status: "publicata", map_precision: "approximate" }),
    Promise.all(PERIODS.map((d) => count(e.ProviderSubscription, { plan_code: "pro", ...since(d) }))),
    Promise.all(PERIODS.map((d) => count(e.ProviderClaimRequest, { status: "aprobata", ...since(d) }))),
  ]);
  return {
    stagesDaily: stages ? stages.rows : null,
    responsesDaily: responses ? responses.rows : null,
    truncated: Boolean(stages?.truncated || responses?.truncated),
    proActive, unconfirmedServices, approxMap,
    trust: { directory: trust[0], claimed: trust[1], verified: trust[2], suspended: trust[3] },
    proNew: Object.fromEntries(PERIODS.map((d, i) => [d, proNew[i]])),
    claimsApproved: Object.fromEntries(PERIODS.map((d, i) => [d, claimsApproved[i]])),
  };
}

// Daca niciuna dintre surse nu a raspuns, nu are sens sa desenam cardurile.
function nothingLoaded(base) {
  const values = [base.stagesDaily, base.responsesDaily, base.proActive, base.unconfirmedServices, base.approxMap, ...Object.values(base.trust)];
  return values.every((value) => value === null);
}

export default function useAdminAnalytics(days) {
  const [base, setBase] = useState(() => cache?.value || null);
  const [loadedAt, setLoadedAt] = useState(() => cache?.at || null);
  const [refreshing, setRefreshing] = useState(false);
  const sequence = useRef(0);

  const load = useCallback(async () => {
    const mine = sequence.current + 1;
    sequence.current = mine;
    setRefreshing(true);
    const value = await loadBase();
    cache = { at: Date.now(), value };
    if (mine !== sequence.current) return;
    setBase(value);
    setLoadedAt(cache.at);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) return undefined;
    load();
    return () => { sequence.current += 1; };
  }, [load]);

  const data = useMemo(() => {
    if (!base) return null;
    const stagesRows = inWindow(base.stagesDaily, days);
    const previousStages = inPreviousWindow(base.stagesDaily, days);
    return {
      stages: sumBy(stagesRows, ["lifecycle_stage"]),
      perDay: buckets(stagesRows, days),
      responses: sumBy(inWindow(base.responsesDaily, days), ["response_type"]),
      // Perioada de dinainte, pentru comparatie (null peste 90 de zile sau cand lipsesc datele).
      previous: previousStages
        ? { stages: sumBy(previousStages, ["lifecycle_stage"]), responses: sumBy(inPreviousWindow(base.responsesDaily, days), ["response_type"]) }
        : null,
      proActive: base.proActive,
      proNew: base.proNew[days],
      claimsApproved: base.claimsApproved[days],
      trust: base.trust,
      unconfirmedServices: base.unconfirmedServices,
      approxMap: base.approxMap,
      truncated: base.truncated,
      unavailable: nothingLoaded(base),
    };
  }, [base, days]);

  return { data, loadedAt, refreshing, refresh: load };
}
