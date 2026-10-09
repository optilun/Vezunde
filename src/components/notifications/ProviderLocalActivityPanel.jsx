import React, { useEffect, useRef, useState } from "react";
import { X, TrendingUp, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
const dateLabel = value => new Date(value).toLocaleDateString("ro-RO", { day: "numeric", month: "short" }).replace(/\.$/, "");
export default function ProviderLocalActivityPanel({ locationId, locations = [], onLocationChange, onClose, onOpenPro = null }) {
  const [data, setData] = useState(null), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const alive = useRef(true), panel = useRef(null);
  useEffect(() => {
    alive.current = true;
    const previousFocus = typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    base44.functions.invoke("providerLeadInboxOps", { action: "local_interest", location_id: locationId })
      .then(response => { if (response.data?.error) throw new Error(response.data.error); if (alive.current) setData(response.data); })
      .catch(() => { if (alive.current) setError("Activitatea nu a putut fi încărcată. Închide panoul și încearcă din nou."); });
    return () => { alive.current = false; previousFocus?.focus?.(); };
  }, [locationId]);
  const toggle = async checked => {
    setSaving(true); setError("");
    try {
      const response = await base44.functions.invoke("providerLeadInboxOps", { action: "local_interest_preference", location_id: locationId, weekly_enabled: checked });
      if (response.data?.error) throw new Error(response.data.error);
      if (alive.current) setData(current => ({ ...current, weekly_enabled: response.data.weekly_enabled }));
    } catch { if (alive.current) setError("Preferința nu a putut fi salvată."); }
    finally { if (alive.current) setSaving(false); }
  };
  const keys = event => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    if (event.key === "Tab") {
      const items = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  const statusCopy = { missing_area: "Completează localitatea locației pentru a vedea activitatea din zonă.", missing_services: "Configurează serviciile active ale locației pentru a vedea căutările relevante.", incomplete: "Datele nu pot fi agregate complet momentan. Nu afișăm totaluri parțiale." };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-3 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="local-activity-title" tabIndex={-1} onKeyDown={keys} className="max-h-[88vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-background p-5 text-foreground shadow-xl outline-none sm:p-7">
      <header className="flex items-start justify-between gap-3"><div><h2 id="local-activity-title" className="flex items-center gap-2 text-xl font-bold"><TrendingUp aria-hidden="true" className="h-5 w-5" />Activitate în zonă</h2><p className="mt-2 text-sm text-muted-foreground">Căutări anonime pentru serviciile locației. Nu sunt cereri trimise locației și nu identifică persoanele.</p></div><button type="button" onClick={onClose} className="shrink-0 rounded-full p-2 hover:bg-secondary" aria-label="Închide activitatea"><X className="h-5 w-5" /></button></header>
      {locations.length > 1 && <label className="mt-4 block text-sm">Locație<select className="ml-2 max-w-full rounded-lg border border-border bg-background p-2" value={locationId} onChange={event => onLocationChange(event.target.value)}>{locations.map(row => <option key={row.id} value={row.id}>{row.name || row.public_display_name || "Locație"}</option>)}</select></label>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 p-3 text-sm text-destructive">{error}</p>}
      {!data && !error && <p role="status" className="mt-6 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă activitatea…</p>}
      {data && <>
        <p className="mt-5 text-sm font-semibold">{data.area_scope === "county" ? "Județul " : ""}{data.area_label || "Zona locației"} · {data.plan_code === "pro" ? "Pro" : "Free"}</p>
        {data.status !== "ready" && <p role="status" className="mt-3 text-sm text-muted-foreground">{statusCopy[data.status] || "Datele nu sunt disponibile."}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">{(data.metrics || []).map(metric => <div key={metric.days} className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Ultimele {metric.days} zile complete</p><p className="mt-2 text-lg font-bold">{metric.status === "available" ? metric.total + " căutări" : "Date insuficiente"}</p></div>)}</div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Actualizat până la {dateLabel(data.period_end)}. Repetările aceleiași sesiuni, pentru același serviciu și aceeași localitate într-o zi, sunt deduplicate. Pentru protejarea anonimatului afișăm valori numai de la 5 sesiuni distincte. Dacă localitatea are prea puține date, folosim județul.</p>
        <p className="mt-2 text-xs text-muted-foreground">{data.data_since ? `Date colectate din ${dateLabel(data.data_since)}. Perioadele mai lungi includ numai datele colectate.` : "Colectarea începe cu căutările înregistrate după activarea acestei funcții. Istoricul anterior nu este inclus."}</p>
        {data.plan_code === "pro" ? <div className="mt-5 rounded-xl border border-border p-4"><h3 className="font-semibold">Servicii căutate · 30 zile</h3>{data.breakdown?.length ? <ul className="mt-3 space-y-2">{data.breakdown.map(row => <li key={row.key} className="flex justify-between gap-4 text-sm"><span>{row.label}</span><strong>{row.total}</strong></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Date insuficiente pentru detalierea serviciilor.</p>}{data.comparison && <p className="mt-4 text-sm">Ultimele 7 zile: <strong>{data.comparison.current}</strong> căutări · precedentele 7 zile: <strong>{data.comparison.previous}</strong>.</p>}</div> : <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4"><h3 className="font-semibold">Evoluție și servicii căutate cu Pro</h3><div aria-hidden="true" className="my-3 flex h-12 items-end gap-3 blur-sm">{[45, 75, 55, 90].map((height, i) => <span key={i} className="w-10 rounded-t bg-blue-200" style={{ height: height + "%" }} />)}</div><p className="text-sm text-muted-foreground">Analize pe 7, 30 și 90 de zile și categorii generale, când există suficiente date. Anonimatul se păstrează și cu Pro.</p>{onOpenPro && <button type="button" className="mt-3 rounded-full border border-blue-200 bg-background px-4 py-2 text-sm font-semibold text-blue-700" onClick={() => { onClose(); onOpenPro(); }}>Vezi beneficiile Pro</button>}</div>}
        <label className="mt-5 flex items-start gap-3 text-sm"><input type="checkbox" checked={data.weekly_enabled === true} disabled={saving} onChange={event => void toggle(event.target.checked)} className="mt-1" /><span>Rezumat săptămânal în notificări<span className="mt-1 block text-xs text-muted-foreground">Săptămâna încheiată apare la încărcarea centrului, dacă sunt suficiente date. Preferința este pentru contul tău și această locație.</span></span></label>
      </>}
    </section>
  </div>;
}
