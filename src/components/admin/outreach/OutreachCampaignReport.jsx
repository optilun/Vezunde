import React, { useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import {
  OUTCOME_LABELS,
  NOT_SENT_REASON_LABELS,
  SOURCE_LABELS,
  outcomeClass,
  callOutreach,
  formatPercent,
  formatDateTime,
  downloadCsv,
} from "./outreachLabels";

// Raportul unei campanii: din jurnalul complet (nu din ultimele 300 de intrari), cu procente
// raportate la emailurile trimise, tabel filtrabil pe rezultat si export CSV pentru Excel.
// Livrat = serverul destinatarului a acceptat emailul (confirmat de Resend prin webhook).
// Deschiderile si click-urile nu sunt urmarite.

const OUTCOME_FILTERS = [
  { value: "all", label: "Toti" },
  { value: "delivered", label: "Livrate" },
  { value: "awaiting", label: "Neconfirmate" },
  { value: "problem", label: "Respinse / reclamatii" },
  { value: "unsubscribed", label: "Dezabonati" },
  { value: "not_sent", label: "Netrimise" },
  { value: "queued", label: "In asteptare" },
];

function matchesOutcomeFilter(row, filter) {
  if (filter === "all") return true;
  if (filter === "delivered") return ["delivered", "replied", "unsubscribed", "complained"].includes(row.outcome);
  if (filter === "problem") return ["bounced", "complained", "failed"].includes(row.outcome);
  return row.outcome === filter;
}

function Tile({ label, value, hint, tone = "" }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${tone || "text-foreground"}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function OutreachCampaignReport({ campaignId, campaignName }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(200);

  const load = async () => {
    setLoading(true);
    const data = await callOutreach("outreachCampaignOps", "campaign_report", { id: campaignId });
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setError("");
    setReport(data);
  };

  useEffect(() => { load(); }, [campaignId]);

  const rows = report?.rows || [];
  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => matchesOutcomeFilter(row, filter)
      && (!term || [row.email, row.company_name, row.city].some((value) => String(value || "").toLowerCase().includes(term))));
  }, [rows, filter, search]);

  const markReplied = async (row) => {
    await callOutreach("outreachCampaignOps", "mark_replied", { log_id: row.id, contact_id: row.contact_id });
    await load();
  };

  const exportCsv = () => {
    const header = ["Email", "Firma", "Localitate", "Sursa", "Rezultat", "Detalii", "Trimis la", "Livrat la"];
    const lines = rows.map((row) => [
      row.email,
      row.company_name,
      row.city,
      SOURCE_LABELS[row.kind] || row.kind,
      OUTCOME_LABELS[row.outcome] || row.outcome,
      row.reason ? (NOT_SENT_REASON_LABELS[row.reason] || row.reason) : row.error,
      formatDateTime(row.sent_at),
      formatDateTime(row.delivered_at),
    ]);
    const safeName = String(campaignName || "campanie").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    downloadCsv(`raport-${safeName || "campanie"}.csv`, header, lines);
  };

  if (loading && !report) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Se incarca raportul...
      </div>
    );
  }
  if (error && !report) return <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>;

  const counts = report?.summary?.counts || {};
  const rates = report?.summary?.rates || {};
  const notSent = Object.entries(report?.summary?.not_sent_by_reason || {});
  const sent = counts.sent || 0;
  const bar = sent > 0 ? [
    { key: "delivered", value: counts.delivered || 0, className: "bg-green-600" },
    { key: "awaiting", value: counts.awaiting || 0, className: "bg-blue-400" },
    { key: "bounced", value: (counts.bounced || 0) + (counts.failed || 0), className: "bg-red-500" },
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">Raport</h3>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizeaza
          </button>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Destinatari" value={counts.recipients || 0} hint={counts.pending_send ? `${counts.pending_send} inca de trimis` : "toti procesati"} />
        <Tile label="Trimise" value={sent} />
        <Tile label="Livrate" value={counts.delivered || 0} hint={`${formatPercent(rates.delivered)} din trimise`} tone="text-green-700" />
        <Tile label="Neconfirmate" value={counts.awaiting || 0} hint="trimise, fara raspuns de la server inca" />
        <Tile label="Respinse" value={counts.bounced || 0} hint={`${formatPercent(rates.bounced)} din trimise`} tone={(counts.bounced || 0) > 0 ? "text-red-700" : ""} />
        <Tile label="Reclamatii spam" value={counts.complained || 0} tone={(counts.complained || 0) > 0 ? "text-red-700" : ""} />
        <Tile label="Dezabonati" value={counts.unsubscribed || 0} hint={`${formatPercent(rates.unsubscribed)} din trimise`} />
        <Tile label="Au raspuns" value={counts.replied || 0} hint="marcat manual" />
        <Tile label="Netrimise" value={counts.not_sent || 0} hint="sarite inainte de trimitere" />
      </div>

      {bar.length > 0 && (
        <div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Din ${sent} trimise: ${counts.delivered || 0} livrate, ${counts.awaiting || 0} neconfirmate, ${(counts.bounced || 0) + (counts.failed || 0)} respinse sau esuate`}>
            {bar.map((part) => part.value > 0 && (
              <div key={part.key} className={part.className} style={{ width: `${(part.value / sent) * 100}%` }} />
            ))}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 text-[11px] text-muted-foreground">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-600" />Livrate</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-400" />Neconfirmate</span>
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Respinse / esuate</span>
          </p>
        </div>
      )}

      {notSent.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Netrimise: {notSent.map(([reason, count]) => `${count} — ${NOT_SENT_REASON_LABELS[reason] || reason}`).join("; ")}.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">Deschiderile si click-urile nu sunt urmarite. Raspunsurile ajung la adresa de reply-to; le marchezi aici cu „A raspuns”.</p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            id="outreach-report-search"
            type="text"
            value={search}
            placeholder="Cauta email, firma, oras..."
            onChange={(e) => { setSearch(e.target.value); setLimit(200); }}
            className="rounded-lg border border-border py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
        {OUTCOME_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => { setFilter(option.value); setLimit(200); }}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${filter === option.value ? "bg-foreground text-background" : "border border-border hover:bg-secondary"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Firma</th>
              <th className="px-3 py-2">Rezultat</th>
              <th className="px-3 py-2">Detalii</th>
              <th className="px-3 py-2">Trimis</th>
              <th className="px-3 py-2">Livrat</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.slice(0, limit).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2">{row.email}</td>
                <td className="px-3 py-2">
                  {row.company_name || "—"}
                  <span className="block text-[10px] text-muted-foreground">{[row.city, SOURCE_LABELS[row.kind]].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${outcomeClass(row.outcome)}`}>{OUTCOME_LABELS[row.outcome] || row.outcome}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.reason ? (NOT_SENT_REASON_LABELS[row.reason] || row.reason) : (row.error || "—")}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDateTime(row.sent_at) || "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDateTime(row.delivered_at) || "—"}</td>
                <td className="px-3 py-2 text-right">
                  {["delivered", "awaiting"].includes(row.outcome) && !row.id.startsWith("queued:") && (
                    <button type="button" onClick={() => markReplied(row)} className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold hover:bg-secondary">
                      A raspuns
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!visibleRows.length && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nimic in aceasta vedere.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {visibleRows.length > limit && (
        <button type="button" onClick={() => setLimit((value) => value + 200)} className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-secondary">
          Arata inca {Math.min(200, visibleRows.length - limit)}
        </button>
      )}
    </div>
  );
}
