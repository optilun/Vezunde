import React from "react";
import { AlertTriangle } from "lucide-react";

// Detaliile ultimei rulari in lot: ce reparatii au esuat sau au fost sarite si de ce.
// Doar afisare - motivele vin neschimbate din backend (apply_batch: failed[], skipped[]).
export default function RepairIssuesList({ issues }) {
  if (!issues || issues.length === 0) return null;
  const failed = issues.filter((issue) => issue.kind === "failed");
  const skipped = issues.filter((issue) => issue.kind === "skipped");

  return (
    <details className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-950" open={failed.length > 0}>
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" />
        Detalii ultima rulare: {failed.length} esuate, {skipped.length} sarite
      </summary>
      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {[...failed, ...skipped].map((issue) => (
          <li key={`${issue.kind}-${issue.id}`} className="rounded-xl border border-amber-200 bg-card px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${issue.kind === "failed" ? "bg-red-100 text-red-800" : "bg-secondary text-muted-foreground"}`}>
                {issue.kind === "failed" ? "Esuata" : "Sarita"}
              </span>
              <strong className="break-words">{issue.title || issue.id}</strong>
            </div>
            <p className="mt-1 break-words text-muted-foreground">{issue.reason}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}