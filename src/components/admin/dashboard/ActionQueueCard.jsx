import React from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from "lucide-react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import AdminLoading from "@/components/admin/ui/AdminLoading";

// „De rezolvat acum” (2026-10-07). Spune „Totul e la zi” NUMAI după ce toate sursele s-au încărcat,
// niciuna nu e indisponibilă și toate sunt 0. Fiecare rând duce direct la sub-tabul unde așteaptă
// lucrul (nu doar la ecranul mare).
export default function ActionQueueCard({ summary, refreshing = false, onRefresh, onNavigate }) {
  return (
    <AdminCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-sm font-bold">De rezolvat acum</h3>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            aria-label="Verifică din nou"
            title="Verifică din nou"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        )}
      </div>

      {!summary.loaded && <div className="mt-3"><AdminLoading label="Se verifică ce așteaptă…" rows={2} /></div>}

      {summary.loaded && summary.rows.length > 0 && (
        <ul className="mt-2 space-y-1">
          {summary.rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                onClick={() => onNavigate(row.section, row.tab)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-secondary"
              >
                <span>{row.label}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{row.count}</span>
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {summary.loaded && summary.unavailable.length > 0 && (
        <div role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft px-3 py-2.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Nu am putut verifica: {summary.unavailable.join(", ")}.
            {onRefresh && (
              <>
                {" "}
                <button type="button" onClick={onRefresh} className="font-semibold underline underline-offset-2">Reîncearcă</button>
              </>
            )}
          </span>
        </div>
      )}

      {summary.allClear && (
        <EmptyState icon={CheckCircle2} title="Totul e la zi." subtitle="Nu așteaptă nimic după tine." />
      )}
    </AdminCard>
  );
}
