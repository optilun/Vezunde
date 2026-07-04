import React from "react";
import { Link } from "react-router-dom";
import { Phone, BadgeCheck, Clock } from "lucide-react";
import { SERVICES, PROVIDER_TYPES } from "@/lib/vezunde";

export default function ResultCard({ location, serviceKeys = [], onRequest }) {
  const matched = (location.services || []).filter((s) => serviceKeys.includes(s));
  const shown = (matched.length > 0 ? matched : location.services || []).slice(0, 3);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type]}</div>
          <h3 className="mt-1 font-heading font-bold text-lg tracking-tight flex items-center gap-1.5">
            {location.name}
            {location.is_verified && <BadgeCheck className="w-4 h-4 text-foreground/50" />}
          </h3>
        </div>
      </div>

      {shown.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shown.map((s) => (
            <span key={s} className="text-xs bg-secondary text-foreground/70 rounded-full px-2.5 py-1">{SERVICES[s]}</span>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {location.opening_hours && (
          <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{location.opening_hours}</div>
        )}
        {location.availability_note && <div>{location.availability_note}</div>}
        {location.phone && (
          <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{location.phone}</div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {location.phone && (
          <a
            href={`tel:${location.phone}`}
            className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:border-foreground/40 transition-colors"
          >
            Suna direct
          </a>
        )}
        <Link
          to={`/furnizor/${location.id}`}
          className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:border-foreground/40 transition-colors"
        >
          Vezi profilul
        </Link>
        <button
          type="button"
          onClick={() => onRequest(location)}
          className="px-4 py-2 rounded-full text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#171717" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2B2B2B"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#171717"; }}
        >
          Trimite solicitare
        </button>
      </div>
    </div>
  );
}