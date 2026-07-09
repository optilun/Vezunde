import React from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, Phone, Route } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import TrustBadge from "@/components/results/TrustBadge";
import ServiceChip from "@/components/results/ServiceChip";

const TIER_LABELS = {
  apropiere: "In zona ta",
  oras: "In localitatea aleasa",
  judet: "In judet",
  national: "In alt oras din Romania",
};

const VARIANT_STYLES = {
  top3: "bg-card border border-primary/30 shadow-[0_4px_24px_rgba(154,74,33,0.08)]",
  confirmed: "bg-card border border-border",
  directory: "bg-secondary/30 border border-dashed border-border/80",
  neutral: "bg-card border border-border",
};

export default function ResultCard({ location, variant = "neutral" }) {
  const allServices = location.public_services || [];
  const shown = (location.matched_public_services?.length ? location.matched_public_services : allServices).slice(0, 3);
  const extra = allServices.length - shown.length;
  const reasons = (location.match_reasons || []).slice(0, 2);
  const hasDistance = Number.isFinite(Number(location.distance_km));

  return (
    <div className={`rounded-2xl p-5 transition-all ${VARIANT_STYLES[variant] || VARIANT_STYLES.neutral}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
          <h3 className="mt-1 font-heading font-bold text-lg leading-snug tracking-tight">{location.name}</h3>
        </div>
        {location.profile_control_status && <TrustBadge status={location.profile_control_status} />}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
        {location.phone && (
          <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{location.phone}</span>
        )}
      </div>

      {shown.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((s) => <ServiceChip key={s.key} label={s.label} />)}
          {extra > 0 && <span className="text-xs text-muted-foreground px-1 py-1">+{extra} servicii</span>}
        </div>
      )}

      {location.routing_reason && (
        <p className="mt-3 rounded-2xl bg-secondary/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{location.routing_reason}</p>
      )}

      {reasons.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">{reasons.join(" · ")}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/furnizor/${location.id}`}
          className="px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Vezi profilul
        </Link>
        {location.phone && (
          <a
            href={`tel:${location.phone.replace(/\s/g, "")}`}
            className="px-4 py-2 rounded-full border border-border bg-card text-sm font-medium hover:border-foreground/40 transition-colors"
          >
            Suna direct
          </a>
        )}
      </div>
    </div>
  );
}
