import React from "react";
import { ArrowLeft, Clock, Info, MapPin, Users, Wrench } from "lucide-react";
import ProviderServices from "./ProviderServices";
import ProviderHours from "./ProviderHours";
import ProviderTeam from "./ProviderTeam";

const MODULES = {
  servicii: {
    label: "Servicii",
    title: "Serviciile locației",
    icon: Wrench,
    capability: "location.manage_content",
    description: "Configurează serviciile, spațiile funcționale și resursele acestei locații.",
  },
  program: {
    label: "Program",
    title: "Programul locației",
    icon: Clock,
    capability: "location.manage_operational_status",
    description: "Stabilește programul normal, excepțiile și modul de primire a clienților.",
  },
  specialisti: {
    label: "Specialiști",
    title: "Specialiștii locației",
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
    <div
      className={
        moduleKey === "servicii"
          ? "provider-location-services-page"
          : `provider-location-module-page provider-location-module-page--${moduleKey}`
      }
    >
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
        <header className="provider-location-module-hero">
          <button type="button" onClick={onBack} className="provider-location-module-hero__back">
            <ArrowLeft aria-hidden="true" /> Înapoi la locații
          </button>
          <div className="provider-location-module-hero__eyebrow">
            <span aria-hidden="true" />
            <strong>Gestionare locație</strong>
          </div>
          <div className="provider-location-module-hero__row">
            <div className="provider-location-module-hero__title">
              <span className="provider-location-module-hero__icon">
                <Icon aria-hidden="true" />
              </span>
              <div>
                <h1>{config.title}</h1>
                <p>{config.description}</p>
              </div>
            </div>
            <div className="provider-location-module-hero__meta">
              <div className="provider-location-module-hero__location">
                <MapPin aria-hidden="true" />
                <span><strong>{locationName}</strong>{locationPlace && <> · {locationPlace}</>}</span>
              </div>
              {moduleKey === "program" && <span className="provider-location-module-hero__status">Se publică imediat</span>}
            </div>
          </div>
        </header>
      )}

      {moduleKey === "program" && (
        <div className="provider-location-module-note md:hidden">
          <Info aria-hidden="true" />
          <span>Pentru fiecare zi, completează mai întâi ora de deschidere, apoi ora de închidere. Butonul de salvare rămâne disponibil în partea de jos a ecranului.</span>
        </div>
      )}

      <div className={moduleKey === "servicii" ? "" : "provider-location-module-page__content"} key={`${location.id}:${moduleKey}`}>
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
    </div>
  );
}
