import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BillingStatus, BILLING_STATUSES, money } from "@/components/workspace/provider/leads/ProviderBillingPanel";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50";
export default function AdminBillingCenter() {
  const [view, setView] = useState("invoices"), [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [cursor, setCursor] = useState(null), [history, setHistory] = useState([]), [next, setNext] = useState(null);
  const [tick, setTick] = useState(0), [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    base44.functions.invoke("providerBillingOps", { action: "admin_list", view, cursor }).then(response => {
      if (response.data?.error) throw new Error(response.data.error);
      if (active) { setRows(response.data.rows); setNext(response.data.has_more ? response.data.next_cursor : null); }
    }).catch(err => { if (active) setError(err?.response?.data?.error || err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [view, cursor, tick]);
  async function synchronize() {
    if (lock.current) return;
    lock.current = true; setSyncing(true); setNotice(""); setError("");
    try {
      const response = await base44.functions.invoke("reconcileProviderStripeSubscriptions", {});
      if (response.data?.error) throw new Error(response.data.error);
      setNotice(`${response.data.synced} abonamente sincronizate. ${response.data.failed} erori.`);
      setTick(t => t + 1);
    } catch (err) { setError(err?.response?.data?.error || err.message); }
    finally { setSyncing(false); lock.current = false; }
  }
  const filtered = rows.filter(row => (!status || row.status === status) && [row.location_name, row.billing_name, row.billing_cui, row.number, row.id].join(" ").toLocaleLowerCase("ro").includes(query.toLocaleLowerCase("ro")));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">{[["invoices","Documente Stripe"],["payments","Tranzacții"],["subscriptions","Abonamente"]].map(([key,label]) => <button key={key} type="button" aria-pressed={view === key} className={button + (view === key ? " !bg-foreground !text-background" : "")} onClick={() => { setView(key); setCursor(null); setHistory([]); setStatus(""); }}>{label}</button>)}</div>
      <button className={button} disabled={syncing || loading} onClick={() => void synchronize()}>{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Sincronizează abonamentele</button>
    </div>
    <p className="text-sm text-muted-foreground">Emitent neplătitor de TVA. Facturile fiscale se emit manual, separat de documentele Stripe. Documentele Stripe, tranzacțiile și abonamentele au stări distincte. Deschide o înregistrare în Stripe pentru administrare, rambursare sau corecție.</p>
    {notice && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}<button className="ml-3 underline" onClick={() => setTick(t => t + 1)}>Reîncearcă</button></p>}
    <div className="flex flex-col gap-2 sm:flex-row"><label className="flex-1"><span className="sr-only">Caută în pagina curentă</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Caută în această pagină: locație, firmă, CUI, factură" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" /></label>
      <label><span className="sr-only">Stare în pagina curentă</span><select className="h-10 rounded-lg border border-border bg-card px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="">Toate stările</option>{[...new Set(rows.map(row => row.status))].sort().map(s => <option key={s} value={s}>{BILLING_STATUSES[s] || s}</option>)}</select></label></div>
    {loading ? <p role="status" className="flex items-center gap-2 py-8 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă evidența Stripe…</p> : !error && <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-secondary text-xs"><tr>{["Dată / Referință","Locație / Firmă","Stare",view === "subscriptions" ? "Preț nominal / unitate" : "Valoare","Acțiuni"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id} className="border-t border-border">
          <td className="px-4 py-4">{new Date(row.created * 1000).toLocaleDateString("ro-RO")}<p className="mt-1 text-xs text-muted-foreground">{row.number || row.id}</p></td>
          <td className="px-4 py-4"><p className="font-medium">{row.location_name}</p><p className="text-xs text-muted-foreground">{row.billing_name || "Date necompletate"}{row.billing_cui && ` · CUI ${row.billing_cui}`}</p></td>
          <td className="px-4 py-4"><BillingStatus status={row.status} />{row.cancel_at_period_end && <p className="mt-1 text-xs">Reînnoire oprită</p>}{row.failure_message && <p className="mt-1 max-w-xs text-xs text-red-700">{row.failure_message}</p>}</td>
          <td className="px-4 py-4">{money(view === "invoices" ? row.total : row.amount,row.currency)}
            {row.amount_remaining > 0 && <p className="mt-1 text-xs text-muted-foreground">Rest: {money(row.amount_remaining,row.currency)}</p>}
            {row.amount_refunded > 0 && <p className="mt-1 text-xs text-muted-foreground">Rambursat: {money(row.amount_refunded,row.currency)}</p>}
          </td>
          <td className="px-4 py-4"><div className="flex flex-wrap gap-3"><a className="inline-flex items-center gap-1 underline" href={row.dashboard_url} target="_blank" rel="noreferrer">Stripe <ExternalLink className="h-3 w-3" /></a>{row.invoice_pdf && <a className="underline" href={row.invoice_pdf} target="_blank" rel="noreferrer">PDF Stripe</a>}{row.hosted_invoice_url && <a className="underline" href={row.hosted_invoice_url} target="_blank" rel="noreferrer">Document Stripe</a>}</div></td>
        </tr>)}</tbody>
      </table>{!filtered.length && <p className="p-6 text-sm text-muted-foreground">Nu există înregistrări VIASEE care corespund filtrelor în această pagină. Poți continua cu pagina următoare.</p>}
    </div>}
    <div className="flex items-center justify-between gap-2"><button className={button} disabled={loading || !history.length} onClick={() => { setCursor(history.at(-1)); setHistory(h => h.slice(0,-1)); }}>Mai recente</button><span className="text-xs text-muted-foreground">Pagina {history.length + 1} · {filtered.length} înregistrări afișate</span><button className={button} disabled={loading || !next} onClick={() => { setHistory(h => [...h,cursor]); setCursor(next); }}>Mai vechi</button></div>
  </div>;
}
