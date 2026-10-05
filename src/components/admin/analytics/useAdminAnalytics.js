import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Toate cifrele se calculeaza pe server (count / aggregate). Un apel esuat
// intoarce null, iar interfata il arata ca "indisponibil", nu ca zero.
const count = (entity, query) => entity.count(query).catch(() => null);
const aggregate = (entity, params) => entity.aggregate(params).then((r) => r.rows || []).catch(() => null);

export default function useAdminAnalytics(days) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
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
      if (!alive) return;
      setData({
        stages, perDay, responses, proActive, proNew, claimsApproved,
        trust: { directory: dir, claimed, verified, suspended },
        unconfirmedServices, approxMap,
      });
    });
    return () => { alive = false; };
  }, [days]);

  return data;
}