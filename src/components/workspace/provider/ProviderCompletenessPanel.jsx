import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, ListChecks, MapPin } from "lucide-react";

function StatusIcon({ done }) {
  return done
    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" />
    : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" />;
}

function actionTarget(item, locationId) {
  if (!item || item.done) return null;
  if (String(item.key || "").startsWith("organization_")) {
    return { label: "Deschide profilul", to: "/contul-meu?s=profile" };
  }
  if (!locationId) return null;
  if (item.group === "services") return { label: "Configureaza serviciile", to: `/contul-meu/locatii/${locationId}/servicii` };
  if (item.group === "program") return { label: "Completeaza programul", to: `/contul-meu/locatii/${locationId}/program` };
  if (item.group === "specialists") return { label: "Gestioneaza specialistii", to: `/contul-meu/locatii/${locationId}/specialisti` };
  return { label: "Deschide locatia", to: `/contul-meu?s=locations&location=${locationId}` };
}

function Item({ item, locationId }) {
  const target = actionTarget(item, locationId);
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 py-3 last:border-b-0 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <StatusIcon done={item.done} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{item.label}</p>
          {!item.done && item.action && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.action}</p>}
        </div>
      </div>
      {!item.done && (
        <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
          {item.impact === "required" && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">Necesara</span>
          )}
          {target && (
            <Link
              to={target.to}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-foreground/30 hover:bg-secondary"
            >
              {target.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function LocationComparison({ locations, selectedLocationId }) {
  if (!Array.isArray(locations) || locations.length < 2) return null;
  return (
    <details className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
      <summary className="cursor-pointer text-sm font-bold text-foreground">Compara locatiile ({locations.length})</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {locations.map((location) => {
          const percentage = Number(location.completion?.percentage || 0);
          const selected = location.id === selectedLocationId;
          const missing = Number(location.completion?.missing_count || 0);
          return (
            <Link
              key={location.id}
              to={`/contul-meu?s=locations&location=${location.id}`}
              className={`rounded-2xl border p-4 transition hover:border-foreground/35 hover:bg-secondary/40 ${selected ? "border-foreground/35 bg-secondary/45" : "border-border bg-background"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{location.name}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{location.locality || "Localitate necompletata"}</p>
                </div>
                {selected && <span className="rounded-full bg-foreground px-2 py-1 text-[10px] font-bold text-background">Selectata</span>}
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-extrabold text-foreground">{percentage}%</div>
                  <div className="text-[11px] text-muted-foreground">{missing ? `${missing} elemente lipsa` : "Profil complet"}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </details>
  );
}

export default function ProviderCompletenessPanel({ data }) {
  if (!data?.summary) return null;
  const missing = [...(data.organization?.missing_items || []), ...(data.location?.missing_items || [])];
  const locationId = data.selected_location_id || "";
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Media locatiilor accesibile</p>
          <p className="mt-1 text-xl font-extrabold text-foreground">{data.summary.average_location_percentage}%</p>
        </div>
      </div>

      {data.summary.required_missing_count > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-relaxed">Sunt {data.summary.required_missing_count} elemente necesare necompletate. Acest indicator explica lipsurile, dar nu modifica automat publicarea sau accesul locatiei.</p>
        </div>
      )}

      <LocationComparison locations={data.locations} selectedLocationId={locationId} />

      <details className="mt-5 rounded-2xl border border-border bg-background/60 p-4">
        <summary className="cursor-pointer text-sm font-bold text-foreground">Vezi ce lipseste la locatia selectata ({missing.length})</summary>
        <div className="mt-3">
          {missing.length
            ? missing.map((item) => <Item key={item.key} item={item} locationId={locationId} />)
            : <p className="text-sm text-muted-foreground">Nu lipseste niciun element din contractul curent.</p>}
        </div>
      </details>
    </section>
  );
}
