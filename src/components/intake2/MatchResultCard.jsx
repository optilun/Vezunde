import React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, MapPin } from "lucide-react";
import { SERVICES, PROVIDER_TYPES } from "@/lib/vezunde";

const TIER_LABELS = {
  apropiere: "In zona apropiata",
  judet: "In judet",
  national: "In alt oras din Romania",
};

export default function MatchResultCard({ location }) {
  const matched = (location.matched_services || []).slice(0, 3);

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 p-5">
      <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type]}</div>
      <h3 className="mt-1 font-heading font-bold text-lg tracking-tight flex items-center gap-1.5">
        {location.name}
        {location.is_verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
      </h3>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="w-3.5 h-3.5" />
        {location.city}
        {TIER_LABELS[location.expansion_tier] && (
          <span className="text-xs bg-card border border-border rounded-full px-2 py-0.5 ml-1">
            {TIER_LABELS[location.expansion_tier]}
          </span>
        )}
      </div>

      {matched.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {matched.map((s) => (
            <span key={s} className="text-xs bg-card border border-border rounded-full px-2.5 py-1">{SERVICES[s] || s}</span>
          ))}
        </div>
      )}

      {(location.match_reasons || []).length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">{location.match_reasons.slice(0, 2).join(" · ")}</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/furnizor/${location.id}`}
          className="px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#171717" }}
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