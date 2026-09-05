import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, Phone, Route } from "lucide-react";
import { summarizePublicServices } from "@/lib/servicePresentation";
import { buildProviderDecisionConfidence } from "../../../shared/providerDecisionConfidence.js";
import TrustBadge from "@/components/results/TrustBadge";
import ServiceChip from "@/components/results/ServiceChip";
import DecisionConfidencePanel from "@/components/results/DecisionConfidencePanel";
import DirectoryProfileNotice from "@/components/provider/DirectoryProfileNotice";
import LocationThumb, { typeVisual } from "@/components/results/LocationThumb";

// Cardul de rezultat.
//
// 2026-09-04. A primit o varianta `compact`, folosita pe ecranul de recomandari alaturi de harta.
// In forma initiala un singur card ocupa aproape tot ecranul, pentru ca panoul de incredere si
// notita de profil nerevendicat erau desfasurate implicit. Rezultatul practic: pacientul compara
// optiuni derulland, nu privind. Varianta compacta plieaza aceleasi blocuri - nu le sterge - si
// aduce 4-5 optiuni in campul vizual.
//
// Ce NU s-a schimbat: variantele vizuale, ordinea, bucketele si textele. Numarul afisat pe
// cardurile din Top 3 este `bucket_rank` primit de la server, redat ca atare, ca sa se poata citi
// corespondenta cu pinul de pe harta. Nu se calculeaza nimic aici.

const TIER_LABELS = {
  apropiere: "In zona ta",
  oras: "În localitatea aleasă",
  judet: "In judet",
  national: "In alt oras din Romania",
};

const VARIANT_STYLES = {
  top3: "bg-card border border-primary/30 shadow-[0_4px_24px_rgba(154,74,33,0.08)]",
  confirmed: "bg-card border border-border",
  directory: "bg-secondary/30 border border-dashed border-border/80",
  neutral: "bg-card border border-border",
};

function confidenceForLocation(location) {
  return buildProviderDecisionConfidence({
    matchedServiceKeys: location.matched_service_keys || [],
    profileControlStatus: location.profile_control_status || "directory",
    availability: location.availability_label ? { label: location.availability_label } : null,
    expansionTier: location.expansion_tier || "oras",
    professionalCount: Number(location.professional_count) || 0,
    needLevel: location.need_level_snapshot || location.need_level || "general",
  });
}

export default function ResultCard({
  location,
  variant = "neutral",
  onProfileClick,
  onPhoneClick,
  onSelect,
  onHover = null,
  selected = false,
  hovered = false,
  compact = false,
}) {
  const [noticeOpen, setNoticeOpen] = useState(false);
  const isDirectoryProfile = location.profile_control_status === "directory";
  const allServices = location.public_services || [];
  const matchedServices = location.matched_public_services?.length ? location.matched_public_services : allServices;
  const serviceSummaries = summarizePublicServices(matchedServices);
  const shown = serviceSummaries.slice(0, 3);
  const extra = Math.max(0, serviceSummaries.length - shown.length);
  const hasDistance = !isDirectoryProfile && Number.isFinite(Number(location.distance_km));
  const confidence = confidenceForLocation(location);
  const rank = variant === "top3" ? Number(location.bucket_rank) || null : null;

  return (
    <div
      onClick={onSelect ? () => onSelect(location) : undefined}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (event) => { if (event.key === "Enter") onSelect(location); } : undefined}
      onMouseEnter={onHover ? () => onHover(location.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      className={`rounded-2xl transition-all ${compact ? "p-4" : "p-5"} ${VARIANT_STYLES[variant] || VARIANT_STYLES.neutral} ${
        onSelect ? "cursor-pointer" : ""
      } ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} ${
        hovered && !selected ? "border-foreground/40 shadow-[0_4px_16px_rgba(23,23,23,0.10)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          <LocationThumb
            name={location.name}
            photoUrl={location.photo_url}
            providerType={location.provider_type}
            size={compact ? "sm" : "md"}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {rank && (
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold leading-none text-primary-foreground"
                  aria-label={`Poziția ${rank} în cele mai potrivite opțiuni`}
                >
                  {rank}
                </span>
              )}
              {typeVisual(location.provider_type).label}
            </div>
            <h3
              className={`mt-1 font-display font-bold leading-tight tracking-tight text-foreground ${
                compact ? "text-base sm:text-lg" : "text-xl"
              }`}
            >
              {location.name}
            </h3>
          </div>
        </div>
        {location.profile_control_status && <TrustBadge status={location.profile_control_status} />}
      </div>

      <div className={`mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
        <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{location.city}</span>
        {hasDistance && (
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><Route className="w-3.5 h-3.5" />{Number(location.distance_km).toFixed(1)} km</span>
        )}
        {TIER_LABELS[location.expansion_tier] && (
          <span className="text-xs bg-card border border-border rounded-full px-2 py-0.5">{TIER_LABELS[location.expansion_tier]}</span>
        )}
        {location.availability_label && (
          <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{location.availability_label}</span>
        )}
        {!compact && location.phone && (
          <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{location.phone}</span>
        )}
      </div>

      {shown.length > 0 && (
        <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-2.5" : "mt-3"}`}>
          {shown.map((s) => <ServiceChip key={s.key} label={s.label} />)}
          {extra > 0 && <span className="text-xs text-muted-foreground px-1 py-1">+{extra} zone</span>}
        </div>
      )}

      <DecisionConfidencePanel confidence={confidence} contextLabel="De ce se potriveste" compact={compact} />

      {location.routing_reason && (
        <p className={`rounded-2xl bg-secondary/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground ${compact ? "mt-2.5" : "mt-3"}`}>
          {location.routing_reason}
        </p>
      )}

      {/* Notita de profil nerevendicat spune ceva important - ca datele vin din surse publice, nu
          de la furnizor - dar in lista repeta acelasi text la fiecare card. In varianta compacta
          ramane la un click distanta, cu eticheta care spune exact ce se deschide. */}
      {isDirectoryProfile && compact && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setNoticeOpen((value) => !value); }}
            aria-expanded={noticeOpen}
            className="text-[11px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {noticeOpen ? "Ascunde sursa datelor" : "De unde vin datele acestui profil"}
          </button>
          {noticeOpen && (
            <div className="mt-2" onClick={(event) => event.stopPropagation()}>
              <DirectoryProfileNotice location={location} compact />
            </div>
          )}
        </div>
      )}

      {isDirectoryProfile && !compact && (
        <div className="mt-4">
          <DirectoryProfileNotice location={location} compact />
        </div>
      )}

      <div className={`flex flex-wrap gap-2 ${compact ? "mt-3" : "mt-4"}`}>
        <Link
          to={`/furnizor/${location.id}`}
          onClick={onProfileClick}
          className={`rounded-full font-medium transition-opacity hover:opacity-90 ${
            compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
          } ${isDirectoryProfile ? "border border-border bg-card text-foreground" : "bg-primary text-primary-foreground"}`}
        >
          {isDirectoryProfile ? "Vezi informațiile publice" : "Vezi profilul"}
        </Link>
        {location.phone && (
          <a
            href={`tel:${location.phone.replace(/\s/g, "")}`}
            onClick={onPhoneClick}
            className={`rounded-full border border-border bg-card font-medium hover:border-foreground/40 transition-colors ${
              compact ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
            }`}
          >
            {compact ? location.phone : "Suna direct"}
          </a>
        )}
      </div>
    </div>
  );
}
