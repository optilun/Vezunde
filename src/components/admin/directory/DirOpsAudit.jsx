import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Filter, History, Loader2, Search, User, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  auditActionLabel,
  auditActorLabel,
  auditActorType,
  auditEntityLabel,
  auditFieldLabel,
  collapseAuditRuns,
} from "@/lib/adminLabels";
import { fullDateTime } from "@/lib/adminFormat";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import EmptyState from "@/components/admin/ui/EmptyState";

const PAGE_SIZE = 200;

// Evenimentele de sistem (importuri, corectii in masa) sunt mult mai numeroase decat actiunile
// oamenilor: la audit, 10 din ultimele 15 erau acelasi eveniment de sistem, iar vechiul „cele mai
// noi 2.000” ascundea istoricul adminului. Filtrul „Oameni” (implicit) cere serverului doar
// evenimentele cu autor; „Sistem” si „Toate” sunt la un click distanta.
const ACTOR_FILTERS = [
  { key: "people", label: "Administratori și furnizori", query: { admin_email: { $ne: null } } },
  { key: "system", label: "Sistem", query: { admin_email: null } },
  { key: "all", label: "Toți", query: {} },
];

function formatDay(value) {
  if (!value) return "Dată necunoscută";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Dată necunoscută";
  return date.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function changedFields(record) {
  return (record.changed_fields || []).map(auditFieldLabel);
}

function AuditRow({ record }) {
  const fields = changedFields(record);
  const type = auditActorType(record);
  return (
    <div className="border-b border-border/70 py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold">{auditActionLabel(record.action_type)}</div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{auditEntityLabel(record.entity_type)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" aria-hidden="true" /> {auditActorLabel(record)}</span>
            <span>{type === "admin" ? "Acțiune admin" : type === "provider" ? "Acțiune furnizor" : "Acțiune de sistem"}</span>
            {fields.length > 0 && <span>{fields.join(", ")}</span>}
          </div>
          {record.note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{record.note}</p>}
        </div>
        <div className="shrink-0 text-xs font-semibold text-muted-foreground" title={fullDateTime(record.performed_at || record.created_date)}>
          {formatTime(record.performed_at || record.created_date)}
        </div>
      </div>
      {(record.previous_values || record.new_values || record.entity_id) && (
        <details className="mt-2 rounded-xl border border-border bg-secondary/25">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">Detalii tehnice</summary>
          <div className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <div>Referință entitate: {record.entity_id || "lipsă"}</div>
            {record.previous_values && record.previous_values !== "{}" && <div className="mt-1 break-all">Înainte: {record.previous_values}</div>}
            {record.new_values && record.new_values !== "{}" && <div className="mt-1 break-all">După: {record.new_values}</div>}
          </div>
        </details>
      )}
    </div>
  );
}

// Un grup de evenimente identice consecutive („1.000 × Corecție de sursă”), desfășurabil.
function AuditGroup({ group }) {
  const [open, setOpen] = useState(false);
  const { head, count, records } = group;
  return (
    <div className="border-b border-border/70 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{count} × {auditActionLabel(head.action_type)}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{auditEntityLabel(head.entity_type)}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" aria-hidden="true" /> {auditActorLabel(head)}</span>
            <span>{open ? "Ascunde detaliile" : "Arată toate"}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
          {formatTime(head.performed_at || head.created_date)}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      {open && <div className="mt-2 border-l-2 border-border pl-4">{records.map((record) => <AuditRow key={record.id} record={record} />)}</div>}
    </div>
  );
}

export default function DirOpsAudit() {
  const [records, setRecords] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("people");
  const [entity, setEntity] = useState("all");
  const [error, setError] = useState("");

  const fetchPage = useCallback(async (actorKey, skip) => {
    const filters = ACTOR_FILTERS.find((item) => item.key === actorKey)?.query || {};
    const rows = await base44.entities.DirectoryAuditRecord.filter(filters, "-created_date", PAGE_SIZE, skip);
    return Array.isArray(rows) ? rows : (rows?.items ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    setRecords(null);
    setError("");
    setEntity("all");
    fetchPage(actor, 0)
      .then((rows) => {
        if (!alive) return;
        setRecords(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((reason) => {
        if (!alive) return;
        setError(reason.response?.data?.error || reason.message || "Nu am putut încărca istoricul.");
        setRecords([]);
        setHasMore(false);
      });
    return () => { alive = false; };
  }, [actor, fetchPage]);

  const loadMore = async () => {
    if (loadingMore || !records) return;
    setLoadingMore(true);
    try {
      const rows = await fetchPage(actor, records.length);
      setRecords((current) => [...(current || []), ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut încărca mai multe evenimente.");
    } finally {
      setLoadingMore(false);
    }
  };

  const entityOptions = useMemo(
    () => [...new Set((records || []).map((record) => record.entity_type).filter(Boolean))].sort(),
    [records],
  );
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (records || []).filter((record) => {
      if (entity !== "all" && record.entity_type !== entity) return false;
      if (!normalizedQuery) return true;
      return [auditActionLabel(record.action_type), auditEntityLabel(record.entity_type), record.admin_email, record.note, ...(record.changed_fields || [])]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [entity, query, records]);

  const grouped = useMemo(() => {
    const output = new Map();
    for (const row of collapseAuditRuns(visible)) {
      const record = row.kind === "group" ? row.head : row.record;
      const day = formatDay(record.performed_at || record.created_date);
      if (!output.has(day)) output.set(day, []);
      output.get(day).push(row);
    }
    return [...output.entries()];
  }, [visible]);

  return (
    <div className="space-y-4">
      <AdminCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_220px_200px]">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută acțiune, utilizator sau câmp"
              aria-label="Caută în istoric"
              className="w-full bg-transparent text-xs outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <select value={actor} onChange={(event) => setActor(event.target.value)} aria-label="Cine a făcut acțiunea" className="w-full bg-transparent text-xs outline-none">
              {ACTOR_FILTERS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <select value={entity} onChange={(event) => setEntity(event.target.value)} aria-label="Tipul de element" className="w-full bg-transparent text-xs outline-none">
              <option value="all">Toate elementele</option>
              {entityOptions.map((item) => <option key={item} value={item}>{auditEntityLabel(item)}</option>)}
            </select>
          </label>
        </div>
        {records && (
          <p className="mt-3 text-xs text-muted-foreground">
            {visible.length} din {records.length} evenimente încărcate{hasMore ? " (mai sunt)" : ""}. Valorile tehnice sunt ascunse implicit.
          </p>
        )}
      </AdminCard>

      {error && <div role="alert" className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
      {!records && <AdminLoading label="Se încarcă istoricul…" />}
      {records && visible.length === 0 && <AdminCard className="p-5"><EmptyState icon={History} title="Niciun eveniment pentru filtrele alese." subtitle="Schimbă filtrele sau termenul de căutare." /></AdminCard>}

      {grouped.map(([day, rows]) => (
        <AdminCard key={day} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/25 px-5 py-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{day}</h3>
            <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold">
              {rows.reduce((sum, row) => sum + (row.kind === "group" ? row.count : 1), 0)}
            </span>
          </div>
          <div className="px-5">
            {rows.map((row) => (row.kind === "group"
              ? <AuditGroup key={row.key} group={row} />
              : <AuditRow key={row.key} record={row.record} />))}
          </div>
        </AdminCard>
      ))}

      {records && hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            Arată mai multe
          </button>
        </div>
      )}
    </div>
  );
}
