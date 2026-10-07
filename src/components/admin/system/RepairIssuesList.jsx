import React from "react";
import { AlertTriangle } from "lucide-react";
import StatusBadge from "@/components/admin/ui/StatusBadge";

// Detaliile ultimei rulări în lot: ce reparații au eșuat sau au fost sărite și de ce.
// Doar afișare — motivele vin neschimbate din backend (apply_batch: failed[], skipped[]).
export default function RepairIssuesList({ issues }) {
  if (!issues || issues.length === 0) return null;
  const failed = issues.filter((issue) => issue.kind === "failed");
  const skipped = issues.filter((issue) => issue.kind === "skipped");

  return (
    <details className="mt-3 rounded-2xl border border-warning-border bg-warning-soft px-4 py-3 text-xs text-warning" open={failed.length > 0}>
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Detalii ultima rulare: {failed.length} eșuate, {skipped.length} sărite
      </summary>
      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {[...failed, ...skipped].map((issue) => (
          <li key={`${issue.kind}-${issue.id}`} className="rounded-xl border border-warning-border bg-card px-3 py-2 text-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={issue.kind === "failed" ? "Eșuată" : "Sărită"} tone={issue.kind === "failed" ? "danger" : "neutral"} />
              <strong className="break-words">{issue.title || issue.id}</strong>
            </div>
            <p className="mt-1 break-words text-muted-foreground">{issue.reason}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
