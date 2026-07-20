import React from "react";
import { AlertTriangle, CheckCircle2, Circle, ListChecks } from "lucide-react";

function StatusIcon({ done }) {
  return done
    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" />
    : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />;
}

function Item({ item }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-3 last:border-b-0">
      <StatusIcon done={item.done} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{item.label}</p>
        {!item.done && item.action && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.action}</p>}
      </div>
      {!item.done && item.impact === "required" && (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Necesara</span>
      )}
    </div>
  );
}

export default function ProviderCompletenessPanel({ data }) {
  if (!data?.summary) return null;
  const missing = [...(data.organization?.missing_items || []), ...(data.location?.missing_items || [])];
  return (
    <section className="rounded-[20px] border border-foreground/10 bg-card p-5 shadow-[0_14px_40px_rgba(23,23,23,0.04)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-bold text-foreground"><ListChecks className="h-4 w-4 text-primary" /> Completarea profilului</p>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Acelasi set de reguli este folosit pentru organizatie, locatie, contact, program, servicii, specialisti, fotografie si verificare.</p>
        </div>
        <div className="shrink-0 rounded-2xl bg-secondary px-4 py-3 text-center">
          <div className="text-2xl font-extrabold text-foreground">{data.summary.overall_percentage}%</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">completare generala</div>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.max(0, Math.min(100, data.summary.overall_percentage || 0))}%` }} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Organizatie</p>
          <p className="mt-1 text-xl font-extrabold text-foreground">{data.summary.organization_percentage}%</p>
        </div>
        <div className="rounded-2xl border border-border bg-background/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locatie selectata</p>
          <p className="mt-1 text-xl font-extrabold text-foreground">{data.summary.average_location_percentage}%</p>
        </div>
      </div>

      {data.summary.required_missing_count > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-relaxed">Sunt {data.summary.required_missing_count} elemente necesare necompletate. Acest indicator explica lipsurile, dar nu modifica automat publicarea sau accesul locatiei.</p>
        </div>
      )}

      <details className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
        <summary className="cursor-pointer text-sm font-bold text-foreground">Vezi ce lipseste ({missing.length})</summary>
        <div className="mt-3">
          {missing.length ? missing.map((item) => <Item key={item.key} item={item} />) : <p className="text-sm text-muted-foreground">Nu lipseste niciun element din contractul curent.</p>}
        </div>
      </details>
    </section>
  );
}
