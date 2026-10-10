import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Inbox, Siren } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import { AdminRefreshButton } from "@/components/admin/ui/AdminListControls";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { fullDateTime, plural, relativeTime } from "@/lib/adminFormat";

// 2026-10-10 (audit trasee -> admin). Fiecare cerere de pacient: dacă a fost trimisă, la câte locații a
// ajuns și dacă are răspuns. Înainte adminul vedea doar un număr pe 7 zile. Doar citire: fără nume,
// email, telefon sau textul scris de pacient (datele vin din directoryOps › adminPatientRequestOps).

const FILTERS = [
  { key: "attention", label: "De rezolvat" },
  { key: "all", label: "Toate" },
  { key: "not_sent", label: "Netrimise" },
  { key: "waiting", label: "Trimise, fără răspuns" },
  { key: "answered", label: "Cu răspuns" },
  { key: "closed", label: "Închise" },
];

const TONE = { danger: "danger", warning: "warning", success: "success", muted: "neutral" };
const RECOVERY_LABELS = { queued: "în coadă", in_review: "în verificare", resolved: "rezolvat", closed: "închis" };

function matchesFilter(row, filter) {
  if (filter === "all") return true;
  if (filter === "attention") return row.attention === true;
  return row.state === filter;
}

function countFor(summary, key) {
  if (!summary) return undefined;
  if (key === "all") return summary.total;
  return summary[key];
}

function errorText(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

function RequestRow({ row, onNavigate }) {
  const facts = [
    plural(row.match_count, "potrivire", "potriviri") + (row.top3_count ? ` (Top 3: ${row.top3_count})` : ""),
    row.state === "not_sent" || row.state === "no_results" ? "" : `ajunsă la ${plural(row.lead_count, "locație", "locații")}`,
    row.lead_count > 0 ? plural(row.response_count, "răspuns", "răspunsuri") : "",
  ].filter(Boolean);
  const place = [row.city, row.county].filter(Boolean).join(", ");

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold tracking-wide">{row.public_reference || row.id}</span>
        <StatusBadge label={row.state_label} tone={TONE[row.state_tone] || "neutral"} />
        {row.urgency === "urgenta" && <StatusBadge label="Urgentă" tone="danger" icon={Siren} />}
        {row.has_safety_flags && <StatusBadge label="Semnal de siguranță" tone="warning" icon={AlertTriangle} />}
      </div>
      <p className="mt-2 text-sm font-medium">
        {row.services.length ? row.services.join(", ") : "Serviciu nespecificat"}
        {place && <span className="text-muted-foreground"> · {place}</span>}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span title={fullDateTime(row.created_date)}>{relativeTime(row.created_date)}</span>
        {facts.map((fact) => <span key={fact}>{fact}</span>)}
        {row.recovery_status && <span>Caz de recuperare: {RECOVERY_LABELS[row.recovery_status] || row.recovery_status}</span>}
      </p>
      {row.recovery_open && (
        <button
          type="button"
          onClick={() => onNavigate?.("workspace_reviews", "patient_requests")}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-secondary"
        >
          Deschide cazul de recuperare
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      {row.attention && !row.recovery_open && (
        <p className="mt-2 text-xs text-muted-foreground">
          {row.state === "undelivered"
            ? "Pacientul a cerut trimiterea, dar nicio locație din zonă nu primește încă cereri prin VIASEE."
            : "Nicio locație potrivită în zonă. Pacientul nu a cerut (încă) ajutorul echipei."}
        </p>
      )}
    </li>
  );
}

export default function AdminPatientRequests({ onNavigate = undefined }) {
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [windowDays, setWindowDays] = useState(120);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("adminPatientRequestOps", { action: "list", filter: "all" });
      const data = response?.data || {};
      if (data.error) throw new Error(data.error);
      if (seq !== loadSeq.current) return;
      setRows(Array.isArray(data.requests) ? data.requests : []);
      setSummary(data.summary || null);
      setWindowDays(Number(data.window_days) || 120);
      setFilter((current) => current || (data.summary?.attention > 0 ? "attention" : "all"));
    } catch (requestError) {
      if (seq === loadSeq.current) setError(errorText(requestError, "Cererile nu au putut fi încărcate."));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeFilter = filter || "all";
  const visible = useMemo(() => (rows || []).filter((row) => matchesFilter(row, activeFilter)), [rows, activeFilter]);
  const options = FILTERS.map((option) => ({ ...option, count: countFor(summary, option.key) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminChips options={options} value={activeFilter} onChange={setFilter} label="Filtrează cererile" />
        <AdminRefreshButton onClick={load} busy={loading} />
      </div>

      {error && <AdminNotice tone="danger">{error}</AdminNotice>}

      <AdminCard className="p-0">
        {loading && rows === null ? (
          <AdminLoading label="Se încarcă cererile…" />
        ) : rows === null ? (
          <EmptyState title="Cererile nu s-au putut încărca" subtitle="Încearcă din nou cu butonul de reîmprospătare." />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={activeFilter === "attention" ? "Nicio cerere nu așteaptă după tine" : "Nicio cerere aici"}
            subtitle={`Sunt afișate cererile din ultimele ${windowDays} de zile.`}
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((row) => <RequestRow key={row.id} row={row} onNavigate={onNavigate} />)}
          </ul>
        )}
      </AdminCard>

      <p className="text-xs text-muted-foreground">
        Cererile din ultimele {windowDays} de zile. Datele de contact și textul scris de pacient nu apar aici.
      </p>
    </div>
  );
}
