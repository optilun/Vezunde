import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Receipt, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { BILLING_STATUSES, money } from "@/components/workspace/provider/leads/ProviderBillingPanel";
import AdminEnterpriseOffers from "@/components/admin/billing/AdminEnterpriseOffers";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import AdminTabs from "@/components/admin/ui/AdminTabs";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { useAdminSubTab } from "@/components/admin/useAdminRoute";
import { PAYMENT_ATTENTION_STATUSES, loadSubscriptionSummary } from "@/lib/adminCounts";
import { billingStatusTone } from "@/lib/adminLabels";
import { matchesAllTokens, normalizeSearch, searchTokens } from "@/lib/adminSearch";

// Plăți și abonamente (2026-10-07). Aceleași date și aceleași apeluri ca înainte (listele vin din Stripe,
// 30 pe pagină, prin providerBillingOps); s-a schimbat doar aspectul: filele stau în adresă, starea
// abonamentelor se vede dintr-o privire și cele cu plată restantă se pot filtra direct din sumar.
const VIEWS = [
  { key: "invoices", label: "Documente Stripe" },
  { key: "payments", label: "Tranzacții" },
  { key: "subscriptions", label: "Abonamente" },
  { key: "enterprise", label: "Oferte Enterprise" },
];
const VIEW_KEYS = VIEWS.map((view) => view.key);
const ATTENTION_FILTER = "attention";

const BUTTON = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50";

const errorText = (error) => error?.response?.data?.error || error?.message || "Operațiunea nu a reușit.";
const formatDay = (seconds) => new Date(seconds * 1000).toLocaleDateString("ro-RO");

function SubscriptionSummary({ summary, onShowAttention }) {
  const value = (number) => (Number.isFinite(number) ? number : "—");
  const attention = summary?.attention > 0;
  return (
    <AdminCard className="p-4">
      <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Abonamente Pro active</dt>
          <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums">{value(summary?.active)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Cu plată restantă</dt>
          <dd className={`mt-0.5 font-heading text-2xl font-extrabold tabular-nums ${attention ? "text-danger" : ""}`}>{value(summary?.attention)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-muted-foreground">Anulate</dt>
          <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums">{value(summary?.canceled)}</dd>
        </div>
        {attention && (
          <button type="button" onClick={onShowAttention} className={`${BUTTON} ml-auto border-danger-border text-danger hover:bg-danger-soft`}>
            Arată abonamentele cu plată restantă
          </button>
        )}
      </dl>
    </AdminCard>
  );
}

function BillingTable({ rows, view }) {
  const subscriptions = view === "subscriptions";
  return (
    <div role="region" aria-label="Lista din Stripe" tabIndex={0} className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-secondary text-xs text-muted-foreground">
          <tr>
            {["Dată / Referință", "Locație / Firmă", "Stare", subscriptions ? "Preț nominal / unitate" : "Valoare", "Acțiuni"].map((label) => (
              <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border align-top">
              <td className="px-4 py-3.5">
                {formatDay(row.created)}
                <p className="mt-1 break-all text-xs text-muted-foreground">{row.number || row.id}</p>
              </td>
              <td className="px-4 py-3.5">
                <p className="font-medium">{row.location_name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.billing_name || "Date necompletate"}
                  {row.billing_cui && ` · CUI ${row.billing_cui}`}
                </p>
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge label={BILLING_STATUSES[row.status] || row.status || "—"} tone={billingStatusTone(row.status)} />
                {row.cancel_at_period_end && <p className="mt-1 text-xs text-muted-foreground">Reînnoire oprită</p>}
                {row.failure_message && <p className="mt-1 max-w-xs text-xs text-danger">{row.failure_message}</p>}
              </td>
              <td className="px-4 py-3.5">
                {money(view === "invoices" ? row.total : row.amount, row.currency)}
                {row.amount_remaining > 0 && <p className="mt-1 text-xs text-muted-foreground">Rest: {money(row.amount_remaining, row.currency)}</p>}
                {row.amount_refunded > 0 && <p className="mt-1 text-xs text-muted-foreground">Rambursat: {money(row.amount_refunded, row.currency)}</p>}
              </td>
              <td className="px-4 py-3.5">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
                  <a className="inline-flex items-center gap-1 underline underline-offset-2" href={row.dashboard_url} target="_blank" rel="noreferrer">
                    Stripe <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  {row.invoice_pdf && <a className="underline underline-offset-2" href={row.invoice_pdf} target="_blank" rel="noreferrer">PDF Stripe</a>}
                  {row.hosted_invoice_url && <a className="underline underline-offset-2" href={row.hosted_invoice_url} target="_blank" rel="noreferrer">Document Stripe</a>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminBillingCenter() {
  const { refresh: refreshCounts } = useAdminCounts();
  const [view, setView] = useAdminSubTab(VIEW_KEYS, "invoices");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [next, setNext] = useState(null);
  // Paginarea aparține filei: la schimbarea filei pornim de la prima pagină, fără apel cu cursorul altei liste.
  const [pager, setPager] = useState({ view: "", cursor: null, history: [] });
  const cursor = pager.view === view ? pager.cursor : null;
  const history = pager.view === view ? pager.history : [];
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState(null);
  const lock = useRef(false);

  useEffect(() => {
    setQuery("");
    setStatus((current) => (current === ATTENTION_FILTER && view === "subscriptions" ? current : ""));
  }, [view]);

  useEffect(() => {
    let alive = true;
    loadSubscriptionSummary(base44).then((value) => { if (alive) setSummary(value); });
    return () => { alive = false; };
  }, [tick]);

  useEffect(() => {
    // „Oferte Enterprise” are propria listă, fără citiri Stripe.
    if (view === "enterprise") { setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    setError("");
    setRows([]);
    base44.functions.invoke("providerBillingOps", { action: "admin_list", view, cursor })
      .then((response) => {
        if (response.data?.error) throw new Error(response.data.error);
        if (alive) {
          setRows(response.data.rows || []);
          setNext(response.data.has_more ? response.data.next_cursor : null);
        }
      })
      .catch((requestError) => { if (alive) { setRows([]); setError(errorText(requestError)); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [view, cursor, tick]);

  const synchronize = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setSyncing(true);
    setNotice(null);
    setError("");
    try {
      const response = await base44.functions.invoke("reconcileProviderStripeSubscriptions", {});
      if (response.data?.error) throw new Error(response.data.error);
      const { synced = 0, failed = 0 } = response.data || {};
      setNotice({ tone: failed > 0 ? "warning" : "success", text: `${synced} abonamente sincronizate${failed > 0 ? `, ${failed} cu eroare` : ""}.` });
      setTick((value) => value + 1);
      refreshCounts();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSyncing(false);
      lock.current = false;
    }
  }, [refreshCounts]);

  const goTo = (nextView) => setView(nextView);
  const showAttention = () => {
    setStatus(ATTENTION_FILTER);
    setQuery("");
    if (view !== "subscriptions") setView("subscriptions");
  };

  // Stările din pagina curentă; filtrul ales rămâne în listă chiar dacă pe pagina nouă nu mai apare nicio astfel de înregistrare.
  const statusOptions = useMemo(() => {
    const present = new Set(rows.map((row) => row.status).filter(Boolean));
    if (status && status !== ATTENTION_FILTER) present.add(status);
    return [...present].sort();
  }, [rows, status]);

  const filtered = useMemo(() => {
    const tokens = searchTokens(query);
    return rows.filter((row) => {
      if (status === ATTENTION_FILTER) {
        if (!PAYMENT_ATTENTION_STATUSES.includes(row.status)) return false;
      } else if (status && row.status !== status) return false;
      if (tokens.length === 0) return true;
      const haystack = normalizeSearch([row.location_name, row.billing_name, row.billing_cui, row.number, row.id].filter(Boolean).join(" "));
      return matchesAllTokens(haystack, tokens);
    });
  }, [query, rows, status]);

  const tabs = VIEWS.map((item) => ({ key: item.key, label: item.label }));
  const goPage = (direction) => setPager(direction === "older"
    ? { view, cursor: next, history: [...history, cursor] }
    : { view, cursor: history.at(-1) ?? null, history: history.slice(0, -1) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminTabs tabs={tabs} value={view} onChange={goTo} label="Plăți și abonamente" />
        <div className="flex items-center gap-1">
          <button type="button" className={BUTTON} disabled={syncing || loading} onClick={() => void synchronize()}>
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
            Sincronizează abonamentele
          </button>
          <AdminHint label="Despre sincronizare">
            Abonamentele se sincronizează singure cu Stripe, la fiecare 30 de minute. Folosește butonul doar dacă ai schimbat ceva în Stripe și vrei să vezi imediat.
          </AdminHint>
        </div>
      </div>

      {view === "enterprise" ? <AdminEnterpriseOffers /> : (
        <>
          <SubscriptionSummary summary={summary} onShowAttention={showAttention} />

          {notice && <AdminNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</AdminNotice>}
          {error && (
            <AdminNotice tone="danger">
              {error}{" "}
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setTick((value) => value + 1)}>Reîncearcă</button>
            </AdminNotice>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex-1">
              <span className="sr-only">Caută în pagina curentă</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Caută în pagina curentă: locație, firmă, CUI, factură"
                className="min-h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <label>
              <span className="sr-only">Filtrează după stare</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="min-h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
              >
                <option value="">Toate stările</option>
                {view === "subscriptions" && <option value={ATTENTION_FILTER}>Cu plată restantă</option>}
                {statusOptions.map((value) => <option key={value} value={value}>{BILLING_STATUSES[value] || value}</option>)}
              </select>
            </label>
            <AdminHint label="Despre aceste liste">
              Documentele Stripe nu sunt facturi fiscale: emitent neplătitor de TVA, facturile fiscale se emit manual,
              separat. Documentele, tranzacțiile și abonamentele au stări diferite. Pentru administrare, rambursare
              sau corecție, deschide înregistrarea în Stripe.
            </AdminHint>
          </div>

          {loading && <AdminLoading label="Se încarcă evidența Stripe…" rows={3} />}
          {!loading && !error && filtered.length > 0 && <BillingTable rows={filtered} view={view} />}
          {!loading && !error && filtered.length === 0 && (
            <AdminCard className="p-5">
              <EmptyState
                icon={Receipt}
                title={rows.length === 0 ? "Nu există înregistrări VIASEE în această pagină." : "Nimic pentru filtrele alese în această pagină."}
                subtitle={next ? "Poți continua cu pagina următoare." : ""}
              />
            </AdminCard>
          )}

          <div className="flex items-center justify-between gap-2">
            <button type="button" className={BUTTON} disabled={loading || history.length === 0} onClick={() => goPage("newer")}>Mai recente</button>
            <span className="text-xs text-muted-foreground">Pagina {history.length + 1} · {filtered.length} înregistrări afișate</span>
            <button type="button" className={BUTTON} disabled={loading || !next} onClick={() => goPage("older")}>Mai vechi</button>
          </div>
        </>
      )}
    </div>
  );
}
