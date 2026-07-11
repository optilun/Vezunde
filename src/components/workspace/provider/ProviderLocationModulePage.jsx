import React from "react";
import { ArrowLeft, Clock, MapPin, Users, Wrench } from "lucide-react";
import ProviderServices from "./ProviderServices";
import ProviderHours from "./ProviderHours";
import ProviderTeam from "./ProviderTeam";

const MODULES = {
  servicii: {
    label: "Servicii",
    icon: Wrench,
    description: "Configureaza serviciile, spatiile functionale si resursele acestei locatii.",
  },
  program: {
    label: "Program",
    icon: Clock,
    description: "Stabileste programul normal, exceptiile si modul de primire a clientilor.",
  },
  specialisti: {
    label: "Specialisti",
    icon: Users,
    description: "Gestioneaza specialistii si invitatiile profesionale asociate acestei locatii.",
  },
};

export default function ProviderLocationModulePage({
  workspace,
  locationId,
  moduleKey,
  overview,
  onBack,
  onRefresh,
}) {
  const location = (workspace.locations || []).find((item) => item.id === locationId) || null;
  const config = MODULES[moduleKey];

  if (!location || !config) {
    return (
      <div className="rounded-[24px] border border-border bg-card p-6 shadow-sm">
        <h1 className="font-heading text-xl font-extrabold tracking-tight">Modul indisponibil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Locatia sau modulul solicitat nu a putut fi gasit.</p>
        <button type="button" onClick={onBack} className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" /> Inapoi la locatii
        </button>
      </div>
    );
  }

  const Icon = config.icon;
  const locationName = location.public_display_name || location.name || "Locatie";

  return (
    <div className="space-y-6">
      <header className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Inapoi la locatii
        </button>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-heading text-2xl font-extrabold tracking-tight">{config.label}</h1>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Pagina locatiei</span>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{config.description}</p>
            </div>
          </div>
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{locationName}</span>
          </div>
        </div>
      </header>

      <div key={`${location.id}:${moduleKey}`}>
        {moduleKey === "servicii" && (
          <ProviderServices
            locationId={location.id}
            location={location}
            overview={overview || { content_summary: { approved_service_count: 0 } }}
            onRefresh={onRefresh || (() => {})}
          />
        )}
        {moduleKey === "program" && (
          <ProviderHours
            locationId={location.id}
            location={location}
            onRefresh={onRefresh || (() => {})}
          />
        )}
        {moduleKey === "specialisti" && <ProviderTeam locationId={location.id} />}
      </div>

      <div className="flex justify-start border-t border-border pt-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" /> Inapoi la locatii
        </button>
      </div>
    </div>
  );
}
