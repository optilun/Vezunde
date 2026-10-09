import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ProviderStatusCenter from "./ProviderStatusCenter";
import ProviderCompletenessPanel from "./ProviderCompletenessPanel";
import { withTransientRetry } from "@/lib/transientRetry";
import { INBOX_PLAN_UNKNOWN_MESSAGE, INBOX_RETRY_OPTIONS } from "@/lib/providerInboxErrors";

function result(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}
export default function ProviderRequestAccessSettings({ locationId, location, onOpenBilling }) {
  const [data, setData] = useState(null);
  const [completeness, setCompleteness] = useState(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null); setCompleteness(null); setError(false);
    withTransientRetry(() => base44.functions.invoke("providerLeadInboxOps", { action: "summary", location_id: locationId }).then(result), INBOX_RETRY_OPTIONS)
      .then(next => { if (active) setData(next); })
      .catch(() => { if (active) setError(true); });
    withTransientRetry(() => base44.functions.invoke("getProviderProfileCompleteness", { location_id: locationId }).then(result), INBOX_RETRY_OPTIONS)
      .then(next => { if (active) setCompleteness(next); }).catch(() => {});
    return () => { active = false; };
  }, [locationId, tick]);
  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">Planul și accesul la cereri pentru <strong>{location?.public_display_name || location?.name || "locația selectată"}</strong>. Abonamentul organizației se aplică tuturor locațiilor ei.</p>
    {data ? <ProviderStatusCenter location={location || {}} entitlement={data.entitlement} counters={data.counters} defaultOpen /> : <p role="status" className="text-sm">{error ? INBOX_PLAN_UNKNOWN_MESSAGE : "Se verifică planul…"}{error && <button type="button" className="ml-3 underline" onClick={() => setTick(value => value + 1)}>Reîncearcă</button>}</p>}
    {/* 2026-10-09 (audit plan Free, F5): pe Free, aici ajunge „Vezi beneficiile Pro” din Cereri. Spunem ce aduce Pro și de la ce preț, cu drum direct spre pachete. */}
    {data?.entitlement?.plan_code === "free" ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dac69b] bg-[#fbf3df] p-4 text-sm">
      <div className="min-w-0 max-w-2xl"><p className="font-semibold">Treci la Pro</p><p className="mt-1 text-muted-foreground">Cu Pro răspunzi cererilor, vezi detaliile complete ale cererilor eligibile (Top 3), folosești chatul VIASEE și poți primi telefonul clientului, cu acordul lui. Pachetele pornesc de la 49 RON/lună pentru o locație.</p></div>
      <button type="button" className="rounded-lg bg-foreground px-3 py-2 font-semibold text-background" onClick={onOpenBilling}>Vezi pachetele Pro</button>
    </div> : <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-4 text-sm"><span>Plata, facturile și schimbarea planului se gestionează în Abonament și facturare.</span><button type="button" className="rounded-lg border border-border px-3 py-2 font-semibold" onClick={onOpenBilling}>Deschide facturarea</button></div>}
    <ProviderCompletenessPanel data={completeness} />
  </div>;
}
