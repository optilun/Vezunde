import React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Building2, MapPin } from "lucide-react";
import ServiceChip from "@/components/results/ServiceChip";
import DecisionConfidencePanel from "@/components/results/DecisionConfidencePanel";
import ProfessionalThumb from "@/components/results/ProfessionalThumb";
import { buildProfessionalDecisionConfidence } from "../../../shared/professionalRecommendation.js";
import { professionalTypeLabel } from "../../../shared/professionalIdentity.js";

// Cardul de rezultat pentru un specialist.
//
// 2026-09-03. Aceeasi familie vizuala ca ResultCard, pana la clasele de varianta: pacientul vede
// aceleasi trepte (Top 3 evidentiat, confirmat, director) indiferent daca se uita la o clinica sau
// la o persoana. Ce difera este continutul, pentru ca intrebarea e alta:
//   - locatia raspunde "ce se face aici si cand e deschis";
//   - specialistul raspunde "ce declara ca face si unde poate fi gasit".
// De aceea aici nu exista program, disponibilitate sau distanta - VIASEE nu detine programul
// personal al nimanui, iar a-l sugera vizual ar fi o afirmatie pe care nu o putem sustine.

const TIER_LABELS = {
  apropiere: "In zona ta",
  oras: "În localitatea aleasă",
  judet: "In judet",
  tara: "In alt oras din Romania",
  national: "In alt oras din Romania",
};

const VARIANT_STYLES = {
  top3: "bg-card border border-primary/30 shadow-[0_4px_24px_rgba(154,74,33,0.08)]",
  confirmed: "bg-card border border-border",
  directory: "bg-secondary/30 border border-dashed border-border/80",
  neutral: "bg-card border border-border",
};

export default function ProfessionalResultCard({
  professional,
  variant = "neutral",
  onProfileClick,
  onLocationClick,
  onSelect,
  selected = false,
  needLevel = "general",
}) {
  const locations = Array.isArray(professional.locations) ? professional.locations : [];
  const primaryLocation = locations[0] || null;
  const extraLocations = Math.max(0, locations.length - 1);

  const matchedLabels = Array.isArray(professional.matched_specialization_labels) && professional.matched_specialization_labels.length > 0
    ? professional.matched_specialization_labels
    : (professional.specialization_labels || []);
  const shown = matchedLabels.slice(0, 3);
  const extraSpecializations = Math.max(0, matchedLabels.length - shown.length);

  const confidence = buildProfessionalDecisionConfidence({
    professionalType: professional.professional_type,
    matchedSpecializations: professional.matched_specializations || [],
    matchedServiceKeys: professional.matched_service_keys || [],
    bestLocationTrust: professional.best_location_trust || "directory",
    publicLocationCount: Number(professional.public_location_count) || locations.length,
    needLevel,
  });

  return (
    <div
      onClick={onSelect ? () => onSelect(professional) : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (event) => { if (event.key === "Enter") onSelect(professional); } : undefined}
      className={`rounded-2xl p-5 transition-all ${VARIANT_STYLES[variant] || VARIANT_STYLES.neutral} ${
        onSelect ? "cursor-pointer" : ""
      } ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <ProfessionalThumb professional={professional} />
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {professional.professional_type_label || professionalTypeLabel(professional.professional_type)}
            </div>
            <h3 className="mt-1 font-display text-xl font-bold leading-tight tracking-tight text-foreground">
              {professional.display_name}
            </h3>
          </div>
        </div>
        {/* Un specialist ajunge in lista doar daca profilul lui este verificat, deci insigna este
            mereu aceeasi. O lasam explicita, nu implicita, ca pacientul sa stie ce a fost verificat. */}
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent bg-accent px-2.5 py-1 text-xs font-medium text-primary">
          <BadgeCheck className="h-3.5 w-3.5" />
          Specialist verificat
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {primaryLocation?.city && (
          <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{primaryLocation.city}</span>
        )}
        {TIER_LABELS[professional.expansion_tier] && (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs">
            {TIER_LABELS[professional.expansion_tier]}
          </span>
        )}
        {primaryLocation?.organization_name && (
          <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{primaryLocation.organization_name}</span>
        )}
      </div>

      {shown.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((label) => <ServiceChip key={label} label={label} />)}
          {extraSpecializations > 0 && (
            <span className="px-1 py-1 text-xs text-muted-foreground">+{extraSpecializations} specializări</span>
          )}
        </div>
      )}

      <DecisionConfidencePanel confidence={confidence} />

      {/* Drumul specialist -> locatie -> organizatie. Fara el, cardul ar fi un capat de drum:
          pacientul afla numele persoanei si nu ar avea unde sa mearga. */}
      {locations.length > 0 && (
        <div className="mt-4 rounded-2xl bg-secondary/60 px-3.5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Unde poate fi găsit
          </p>
          <ul className="mt-2 space-y-1.5">
            {locations.slice(0, 2).map((location) => (
              <li key={location.id} className="text-sm leading-snug">
                <Link
                  to={`/furnizor/${location.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (onLocationClick) onLocationClick(location);
                  }}
                  className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
                >
                  {location.name}
                </Link>
                {location.city && <span className="text-muted-foreground"> · {location.city}</span>}
              </li>
            ))}
          </ul>
          {extraLocations > 1 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              și încă {extraLocations - 1} {extraLocations - 1 === 1 ? "locație" : "locații"} pe profilul complet
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/specialist/${professional.id}`}
          onClick={onProfileClick}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Vezi profilul specialistului
        </Link>
        {primaryLocation && (
          <Link
            to={`/furnizor/${primaryLocation.id}`}
            onClick={(event) => {
              event.stopPropagation();
              if (onLocationClick) onLocationClick(primaryLocation);
            }}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
          >
            Vezi locația
          </Link>
        )}
      </div>
    </div>
  );
}
