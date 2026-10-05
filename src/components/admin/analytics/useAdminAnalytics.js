import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MAX_DAYS, buckets, inWindow, sumBy } from "./analyticsWindow";

// Toate cifrele se calculeaza pe server (count / aggregate). Un apel esuat
// intoarce null, iar interfata il arata ca "indisponibil", nu ca zero.
// O singura incarcare pentru toate perioadele; tinuta 5 minute in memorie.
const count = (entity, query) => entity.count(query).catch(() => null);
const aggregate = (entity, params) => entity.aggregate(params).then((r) => r.rows || []).catch(() => null);
const PERIODS = [7, 30, 90];
const TTL_MS = 5 * 60 * 1000;
let cache = null;

async function loadBase() {
  const e = base44.entities;
  const since = (d) => ({ created_date: { $gte: new Date(Date.now() - d * 86400000).toISOString() } });
  const daily = { field: "created_date", unit: "day" };
  const [stagesDaily, responsesDaily, proActive, trust, unconfirmedServices, approxMap, proNew, claimsApproved] = await Promise.all([
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
    stagesDaily, responsesDaily, proActive, unconfirmedServices, approxMap,
    trust: { directory: trust[0], claimed: trust[1], verified: trust[2], suspended: trust[3] },
    proNew: Object.fromEntries(PERIODS.map((d, i) => [d, proNew[i]])),
    claimsApproved: Object.fromEntries(PERIODS.map((d, i) => [d, claimsApproved[i]])),
  };
}

export default function useAdminAnalytics(days) {
  const [base, setBase] = useState(() => cache?.value || null);

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL_MS) return undefined;
    let alive = true;
    loadBase().then((value) => {
      cache = { at: Date.now(), value };
      if (alive) setBase(value);
    });
    return () => { alive = false; };
  }, []);

  return useMemo(() => {
    if (!base) return null;
    const stagesRows = inWindow(base.stagesDaily, days);
    return {
      stages: sumBy(stagesRows, ["lifecycle_stage"]),
      perDay: buckets(stagesRows, days),
      responses: sumBy(inWindow(base.responsesDaily, days), ["response_type"]),
      proActive: base.proActive,
      proNew: base.proNew[days],
      claimsApproved: base.claimsApproved[days],
      trust: base.trust,
      unconfirmedServices: base.unconfirmedServices,
      approxMap: base.approxMap,
    };
  }, [base, days]);
}