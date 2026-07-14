import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";

// General directory browse card — locality-only search, no service matching.
// Intentionally has NO score, NO recommendation badge, NO Top 3 styling.
export default function DirectoryResultCard({ location }) {
  return (
    <div className="rounded-2xl p-5 bg-card border border-border">
      <div className="text-xs font-medium text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
      <h3 className="mt-1 font-heading font-bold text-lg leading-snug tracking-tight">{location.name}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{location.city}{location.address ? `, ${location.address}` : ""}</span>
        {location.phone && (
          <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{location.phone}</span>
        )}
      </div>

      {location.service_coverage_status === "not_listed" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Serviciile acestui profil nu sunt inca listate sau confirmate pe Vezunde.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/furnizor/${location.id}`}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 lg:min-h-0"
        >
          Vezi profilul
        </Link>
        {location.phone && (
          <a
            href={`tel:${location.phone.replace(/\s/g, "")}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40 lg:min-h-0"
          >
            Suna direct
          </a>
        )}
      </div>
    </div>
  );
}
