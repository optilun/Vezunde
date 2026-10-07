import React, { useCallback, useEffect, useState } from "react";
import { Mail, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { fullDateTime, relativeTime } from "@/lib/adminFormat";
import {
  deliveryChannelLabel,
  deliveryRecipientLabel,
  deliveryStatusLabel,
  deliveryStatusTone,
  humanizeCode,
} from "@/lib/adminLabels";

// Jurnalul trimiterilor (2026-10-07): ce emailuri automate au plecat, care au eșuat și de ce.
// Citește CommunicationDelivery (doar admin). Numerele de pe filtre vin din count(), deci sunt exacte
// chiar dacă lista se încarcă treptat.
const PAGE_SIZE = 50;
const STATUSES = ["failed", "pending", "sent", "skipped"];
const STATUS_FILTER_LABELS = { failed: "Eșuate", pending: "În așteptare", sent: "Trimise", skipped: "Sărite" };

const timeOf = (row) => row.sent_at || row.failed_at || row.skipped_at || row.last_attempt_at || row.queued_at || row.created_date;

export default function EmailDeliveryLog({ titles = {} }) {
  const { counts: adminCounts, refresh: refreshCounts } = useAdminCounts();
  const failuresAtOpen = adminCounts?.email_failures;
  const [status, setStatus] = useState(() => (failuresAtOpen > 0 ? "failed" : "all"));
  const [rows, setRows] = useState(null);
  const [totals, setTotals] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async (filter, skip) => {
    const entity = base44.entities.CommunicationDelivery;
    return filter === "all"
      ? entity.list("-created_date", PAGE_SIZE, skip)
      : entity.filter({ status: filter }, "-created_date", PAGE_SIZE, skip);
  }, []);

  const loadTotals = useCallback(async () => {
    try {
      const entries = await Promise.all(STATUSES.map(async (key) => [key, await base44.entities.CommunicationDelivery.count({ status: key })]));
      setTotals(Object.fromEntries(entries));
    } catch {
      setTotals(null);
    }
  }, []);

  const load = useCallback(async (filter) => {
    setError("");
    setRows(null);
    try {
      const page = await fetchPage(filter, 0);
      setRows(page || []);
      setHasMore((page || []).length === PAGE_SIZE);
    } catch (requestError) {
      setRows([]);
      setHasMore(false);
      setError(requestError?.response?.data?.error || requestError?.message || "Jurnalul nu a putut fi încărcat.");
    }
  }, [fetchPage]);

  useEffect(() => { loadTotals(); }, [loadTotals]);
  useEffect(() => { load(status); }, [status, load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchPage(status, rows.length);
      setRows((current) => [...current, ...(page || [])]);
      setHasMore((page || []).length === PAGE_SIZE);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError?.message || "Nu am putut încărca mai multe.");
    } finally {
      setLoadingMore(false);
    }
  };

  const refresh = () => { loadTotals(); load(status); refreshCounts(); };

  const total = totals ? STATUSES.reduce((sum, key) => sum + (totals[key] || 0), 0) : null;
  const chips = [
    { key: "all", label: "Toate", count: total ?? undefined },
    ...STATUSES.map((key) => ({ key, label: STATUS_FILTER_LABELS[key], count: totals ? totals[key] : undefined })),
  ];

  return (
    <div className="space-y-4">
      <AdminCard className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminChips options={chips} value={status} onChange={setStatus} label="Filtrează trimiterile" />
          <button
            type="button"
            onClick={refresh}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Actualizează
          </button>
        </div>
      </AdminCard>

      {error && <AdminNotice tone="danger">{error}</AdminNotice>}
      {rows === null && <AdminLoading label="Se încarcă jurnalul…" />}

      {rows !== null && rows.length === 0 && !error && (
        <AdminCard className="p-5">
          <EmptyState
            icon={Mail}
            title={status === "all" ? "Niciun email în jurnal încă." : `Niciun email ${STATUS_FILTER_LABELS[status].toLowerCase()}.`}
            subtitle="Aici apar emailurile trimise automat după cereri, către pacienți și furnizori."
          />
        </AdminCard>
      )}

      {rows !== null && rows.length > 0 && (
        <AdminCard className="overflow-hidden p-0">
          <ul className="divide-y divide-border" aria-label="Trimiteri recente">
            {rows.map((row) => {
              const problem = row.status === "failed" ? row.last_error : row.status === "skipped" ? row.skip_reason : "";
              return (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge label={deliveryStatusLabel(row.status)} tone={deliveryStatusTone(row.status)} />
                        <span className="text-sm font-semibold">{titles[row.event_key] || humanizeCode(row.event_key)}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {deliveryRecipientLabel(row.recipient_type)} · {deliveryChannelLabel(row.channel)}
                        {row.attempt_count > 1 ? ` · ${row.attempt_count} încercări` : ""}
                      </p>
                      {row.subject_preview && <p className="mt-1 break-words text-xs">{row.subject_preview}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground" title={fullDateTime(timeOf(row))}>
                      {relativeTime(timeOf(row))}
                    </span>
                  </div>
                  {problem && (
                    <p className={`mt-2 break-words rounded-lg px-3 py-2 text-xs ${row.status === "failed" ? "bg-danger-soft text-danger" : "bg-secondary text-muted-foreground"}`}>
                      {row.status === "failed" ? "Motiv: " : "Sărit: "}
                      {row.status === "skipped" ? humanizeCode(problem) : problem}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="border-t border-border p-3 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={loadMore}
                className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                {loadingMore ? "Se încarcă…" : "Arată mai vechi"}
              </button>
            </div>
          )}
        </AdminCard>
      )}
    </div>
  );
}
