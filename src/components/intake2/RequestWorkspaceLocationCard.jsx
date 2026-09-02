import React from "react";
import { CheckCircle2, ExternalLink, MapPin, MessageCircle, Store } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { summarizePublicServices } from "@/lib/servicePresentation";

const TRUST_LABELS = {
  directory: "Listata",
  claimed: "Revendicata",
  verified: "Verificata",
  suspended: "Suspendata",
};

const RESPONSE_LABELS = {
  can_help: "Locația poate ajuta",
  needs_details: "Sunt necesare detalii",
  cannot_help: "Locația nu poate ajuta",
};

function cleanExplanation(value) {
  if (typeof value === "string") {
    const parts = value.split(":");
    return (parts.length > 1 ? parts.slice(1).join(":") : value).trim();
  }
  return String(value?.label || "").trim();
}

function locationName(location) {
  return location?.public_display_name || location?.name || "Locatie";
}

function locationCity(location) {
  return location?.locality_name || location?.city || "";
}

export default function RequestWorkspaceLocationCard({
  location,
  response,
  selected = false,
  unread = 0,
  requestTerminal = false,
  onSelect,
}) {
  const services = location?.matched_public_services?.length
    ? location.matched_public_services
    : (location?.public_services || location?.matched_service_keys || []);
  const serviceLabels = summarizePublicServices(services).slice(0, 2);
  const explanations = (location?.recommendation_explanations || location?.match_reasons || [])
    .map(cleanExplanation)
    .filter(Boolean)
    .slice(0, 2);
  const responseLabel = requestTerminal
    ? "Cerere finalizata"
    : (RESPONSE_LABELS[response?.response_type] || "Cerere trimisa");
  const trust = TRUST_LABELS[location?.profile_control_status] || "Listata";
  const profileAvailable = response ? response.profile_available !== false : true;

  return (
    <article className={`rounded-2xl border bg-card transition-colors ${selected ? "border-primary shadow-[0_8px_28px_rgba(154,74,33,0.10)]" : "border-border hover:border-primary/40"}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full p-4 text-left"
        aria-pressed={selected}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {PROVIDER_TYPES[location?.provider_type] || location?.provider_type || "Furnizor"}
            </p>
            <h3 className="mt-1 truncate text-sm font-extrabold text-foreground">{locationName(location)}</h3>
          </div>
          {unread > 0 && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-1 text-[10px] font-extrabold text-primary-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {locationCity(location) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {locationCity(location)}</span>}
          <span className="rounded-full border border-border bg-background px-2 py-0.5">{trust}</span>
        </div>

        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
          {response?.response_type ? <MessageCircle className="h-3.5 w-3.5 text-primary" /> : <Store className="h-3.5 w-3.5 text-muted-foreground" />}
          {responseLabel}
        </p>

        {serviceLabels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {serviceLabels.map((service) => (
              <span key={service.key} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-foreground">
                {service.label}
              </span>
            ))}
          </div>
        )}

        {explanations.length > 0 && (
          <ul className="mt-3 space-y-1">
            {explanations.map((explanation) => (
              <li key={explanation} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{explanation}</span>
              </li>
            ))}
          </ul>
        )}
      </button>

      {profileAvailable && (
        <div className="border-t border-border px-4 py-3">
          <a
            href={`/furnizor/${location?.id || location?.location_id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            Vezi profilul <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </article>
  );
}
