// Completarea profilului, mutata in tabul "Cont" (2026-08-22).
//
// Aceleasi date si aceleasi reguli ca inainte - se schimba doar limbajul vizual, ca sa fie
// acelasi cu restul modulului: fundal crem cu textura, titluri font-heading, placi tonale
// din paleta in loc de culorile implicite Tailwind.
import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, ListChecks, MapPin } from "lucide-react";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

function StatusIcon({ done }) {
  return done
    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[#315c3a]" />
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
          <p className="font-heading text-sm font-bold tracking-[-0.015em] text-foreground">{item.label}</p>
          {!item.done && item.action && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.action}</p>}
        </div>
      </div>
      {!item.done && (
        <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
          {item.impact === "required" && (
            <span style={{ borderColor: "#dac69b", backgroundColor: "#eadcba" }} className="rounded-full border px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black/65">Necesara</span>
          )}
          {target && (
            <Link
              to={target.to}
              className="inline-flex items-center gap-1.5 rounded-full border border-foreground/20 bg-white/70 px-3 py-1.5 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45"
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
    <details className="mt-5 rounded-[1.4rem] border border-[#e3ddd0] bg-white/60 p-4">
      <summary className="cursor-pointer font-heading text-sm font-extrabold tracking-[-0.02em] text-foreground">Compara locatiile ({locations.length})</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {locations.map((location) => {
          const percentage = Number(location.completion?.percentage || 0);
          const selected = location.id === selectedLocationId;
          const missing = Number(location.completion?.missing_count || 0);
          return (
            <Link
              key={location.id}
              to={`/contul-meu?s=locations&location=${location.id}`}
              className={`rounded-[1.2rem] border p-4 transition-colors hover:border-foreground/35 ${selected ? "border-foreground/35 bg-[#f5f1e9]" : "border-[#e3ddd0] bg-[#fdfbf6]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-extrabold tracking-[-0.02em] text-foreground">{location.name}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{location.locality || "Localitate necompletata"}</p>
                </div>
                {selected && <span className="rounded-full bg-[#171717] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white">Selectata</span>}
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="font-heading text-2xl font-extrabold tracking-[-0.045em] text-foreground">{percentage}%</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{missing ? `${missing} elemente lipsa` : "Profil complet"}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e3ddd0]">
                <div className="h-full rounded-full bg-[#171717]" style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} />
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
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] px-6 py-7">
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={GRAIN} />

      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">
              <ListChecks aria-hidden="true" className="h-3.5 w-3.5" /> Completarea profilului
            </p>
            <h2 className="mt-3 max-w-xl font-heading text-[1.8rem] font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-[2.1rem]">
              Cat de complet este profilul.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Acelasi set de reguli este folosit pentru organizatie, locatie, contact, program, servicii, specialisti, fotografie si verificare.</p>
          </div>
          <div
            style={{ borderColor: "#c6d3da", backgroundColor: "#dce5e9" }}
            className="relative shrink-0 overflow-hidden rounded-[1.4rem] border px-5 py-4 text-center"
          >
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <div className="relative z-10 font-heading text-[2.4rem] font-extrabold leading-none tracking-[-0.05em] text-[#1c1c1c]">{data.summary.overall_percentage}%</div>
            <div className="relative z-10 mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-black/55">completare generala</div>
          </div>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e3ddd0]">
          <div className="h-full rounded-full bg-[#171717] transition-all" style={{ width: `${Math.max(0, Math.min(100, data.summary.overall_percentage || 0))}%` }} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Organizatie", value: data.summary.organization_percentage, border: "#ccd2ba", bg: "#dfe3d2" },
            { label: "Media locatiilor accesibile", value: data.summary.average_location_percentage, border: "#d4c6d8", bg: "#e8e0ea" },
          ].map((item) => (
            <div
              key={item.label}
              style={{ borderColor: item.border, backgroundColor: item.bg }}
              className="relative overflow-hidden rounded-[1.4rem] border px-5 py-4"
            >
              <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
              <p className="relative z-10 font-heading text-[2rem] font-extrabold leading-none tracking-[-0.05em] text-[#1c1c1c]">{item.value}%</p>
              <p className="relative z-10 mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-black/55">{item.label}</p>
            </div>
          ))}
        </div>

        {data.summary.required_missing_count > 0 && (
          <div
            style={{ borderColor: "#dac69b", backgroundColor: "#eadcba" }}
            className="relative mt-5 flex items-start gap-3 overflow-hidden rounded-[1.4rem] border px-5 py-4"
          >
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <AlertTriangle className="relative z-10 mt-0.5 h-4 w-4 shrink-0 text-black/55" />
            <p className="relative z-10 text-[13px] leading-relaxed text-black/65">Sunt {data.summary.required_missing_count} elemente necesare necompletate. Acest indicator explica lipsurile, dar nu modifica automat publicarea sau accesul locatiei.</p>
          </div>
        )}

        <LocationComparison locations={data.locations} selectedLocationId={locationId} />

        <details className="mt-5 rounded-[1.4rem] border border-[#e3ddd0] bg-white/60 p-4">
          <summary className="cursor-pointer font-heading text-sm font-extrabold tracking-[-0.02em] text-foreground">Vezi ce lipseste la locatia selectata ({missing.length})</summary>
          <div className="mt-3">
            {missing.length
              ? missing.map((item) => <Item key={item.key} item={item} locationId={locationId} />)
              : <p className="text-sm text-muted-foreground">Nu lipseste niciun element din contractul curent.</p>}
          </div>
        </details>
      </div>
    </section>
  );
}
