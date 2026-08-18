// Faza 2: marcajele de stare ale unui rand de serviciu, extrase 1:1.
import React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export function StatusBadge({ prerequisite }) {
  if (!prerequisite || prerequisite.status === "available") return null;
  const blocked = prerequisite.eligible === false;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${blocked ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
      {blocked ? <AlertTriangle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
      {prerequisite.status_label || (blocked ? "Opțiune indisponibilă" : "Informație declarată")}
    </span>
  );
}

export function ChangeBadge({ draftAddition, removalRequested, modified }) {
  if (removalRequested) return <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-900">Eliminare propusă</span>;
  if (modified) return <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Modificat în draft</span>;
  if (draftAddition) return <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Nou în draft</span>;
  return null;
}