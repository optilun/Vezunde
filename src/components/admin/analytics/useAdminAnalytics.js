import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Toate cifrele se calculeaza pe server (count / aggregate). Un apel esuat
// intoarce null, iar interfata il arata ca "indisponibil", nu ca zero.
const count = (entity, query) => entity.count(query).catch(() => null);
const aggregate = (entity, params) => entity.aggregate(params).then((r) => r.rows || []).catch(() => null);

// Rezultatele raman 5 minute in memorie pe fiecare perioada: revenirea la 7/30/90
// nu mai refoloseste limita de aggregate si se afiseaza imediat.
const cache = new Map();
const TTL_MS = 5 * 60 * 1000;

export default function useAdminAnalytics(days) {
  const [data, setData] = useState(() => cache.get(days)?.value || null);

  useEffect(() => {
    let alive = true;
    const hit = cache.get(days);
    if (hit && Date.now() - hit.at < TTL_MS) { setData(hit.value); return undefined; }
    setData(null);
    const e = base44.entities;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const inPeriod = { created_date: { $gte: since } };
    Promise.all([
      aggregate(e.PatientRequest, { query: inPeriod, groupBy: "lifecycle_stage" }),
      aggregate(e.PatientRequest, { query: inPeriod, dateBucket: { field: "created_date", unit: days > 30 ? "week" : "day" } }),
      aggregate(e.ProviderLeadResponse, { query: inPeriod, groupBy: "response_type" }),
      count(e.ProviderSubscription, { plan_code: "pro", status: { $in: ["active", "trialing", "grace_period"] } }),
      count(e.ProviderSubscription, { plan_code: "pro", ...inPeriod }),
      count(e.ProviderClaimRequest, { status: "aprobata", ...inPeriod }),
      ...["directory", "claimed", "verified", "suspended"].map((s) => count(e.ProviderLocation, { status: "publicata", profile_control_status: s })),
      count(e.LocationService, { confirmation_level: "not_confirmed" }),
      count(e.ProviderLocation, { status: "publicata", map_precision: "approximate" }),
    ]).then(([stages, perDay, responses, proActive, proNew, claimsApproved, dir, claimed, verified, suspended, unconfirmedServices, approxMap]) => {
      const value = {
        stages, perDay, responses, proActive, proNew, claimsApproved,
        trust: { directory: dir, claimed, verified, suspended },
        unconfirmedServices, approxMap,
      };
      cache.set(days, { at: Date.now(), value });
      if (alive) setData(value);
    });
    return () => { alive = false; };
  }, [days]);

  return data;
}