import React from "react";
import { ArrowLeft, Clock, Info, MapPin, Users, Wrench } from "lucide-react";
import ProviderServices from "./ProviderServices";
import ProviderHours from "./ProviderHours";
import ProviderTeam from "./ProviderTeam";

const MODULES = {
  servicii: {
    label: "Servicii",
    icon: Wrench,
    capability: "location.manage_content",
    description: "Configurează serviciile, spațiile funcționale și resursele acestei locații.",
  },
  program: {
    label: "Program",
    icon: Clock,
    capability: "location.manage_operational_status",
    description: "Stabilește programul normal, excepțiile și modul de primire a clienților.",
  },
  specialisti: {
    label: "Specialiști",
    icon: Users,
    capability: "location.manage_specialists",
    description: "Gestionează specialiștii și invitațiile profesionale asociate acestei locații.",
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
  const capabilities = new Set(workspace.current_user_capabilities || []);
  const hasModuleAccess = Boolean(config && capabilities.has(config.capability));

  if (!location || !config || !hasModuleAccess) {
    return (
      <div className="rounded-[20px] border border-foreground/10 bg-card p-6 shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
        <h1 className="font-heading text-xl font-extrabold tracking-tight">Modul indisponibil</h1>
        <p className="mt-2 text-sm text-muted-foreground">{location && config ? "Rolul tău nu permite accesul la acest modul." : "Locația sau modulul solicitat nu a putut fi găsit."}</p>
        <button type="button" onClick={onBack} className="mt-5 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" /> Înapoi la locații
        </button>
      </div>
    );
  }

  const Icon = config.icon;
  const locationName = location.public_display_name || location.name || "Locație";
  const locationPlace = [location.locality || location.city, location.county]
    .filter(Boolean)
    .join(", ");

  return (
    <div className={moduleKey === "servicii" ? "provider-location-services-page" : "space-y-6"}>
      {moduleKey === "servicii" ? (
        <header className="provider-location-services-header">
          <button type="button" onClick={onBack} className="provider-location-services-header__back">
            <ArrowLeft aria-hidden="true" /> Înapoi la locații
          </button>
          <div className="provider-location-services-header__content">
            <div className="provider-location-services-header__eyebrow">
              <span aria-hidden="true" />
              <strong>Configurare locație</strong>
            </div>
            <div className="provider-location-services-header__row">
              <div>
                <h1>Serviciile locației</h1>
                <p>Alege serviciile, spațiile și activitățile pe care clienții le pot găsi la această locație.</p>
              </div>
              <div className="provider-location-services-header__location">
                <MapPin aria-hidden="true" />
                <span><strong>{locationName}</strong>{locationPlace && <> · {locationPlace}</>}</span>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header className="provider-location-module-header rounded-[20px] border border-foreground/10 bg-card p-5 shadow-[0_14px_40px_rgba(23,23,23,0.04)] sm:p-6">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Înapoi la locații
          </button>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#eaf0fc] text-[#345bc8]">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-[2rem] font-extrabold leading-tight tracking-[-0.035em]">{config.label}</h1>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">Pagina locației</span>
                </div>
                <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{config.description}</p>
              </div>
            </div>
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{locationName}</span>
            </div>
          </div>
        </header>
      )}

      {moduleKey === "program" && (
        <div className="flex items-start gap-2 rounded-[18px] border border-border bg-secondary/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground md:hidden">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Pentru fiecare zi, completează mai întâi ora de deschidere, apoi ora de închidere. Butonul de salvare rămâne disponibil în partea de jos a ecranului.</span>
        </div>
      )}

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

      {moduleKey !== "servicii" && (
        <div className="flex justify-start border-t border-border pt-4">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary">
            <ArrowLeft className="h-4 w-4" /> Înapoi la locații
          </button>
        </div>
      )}
    </div>
  );
}
