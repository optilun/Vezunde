import React from "react";
import { Link } from "react-router-dom";
import { MapPin, BadgeCheck, Clock, Phone } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";

// Module 3E.1: cards render ONLY public_services / matched_public_services from
// the whitelist backend response — never raw entity or legacy service data.
export default function ProviderCard({ location, matchedServices = [] }) {
  const publicServices = location.public_services || [];
  const shown = (matchedServices.length > 0 ? matchedServices : publicServices).slice(0, 3);
  return (
    <Link
      to={`/furnizor/${location.id}`}
      className="group block bg-card rounded-2xl border border-border p-6 transition-all hover:border-primary/40 hover:shadow-[0_2px_16px_rgba(17,17,17,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-primary">{PROVIDER_TYPES[location.provider_type]}</div>
          <h3 className="mt-1 font-heading font-bold text-lg leading-snug group-hover:text-primary transition-colors">{location.name}</h3>
        </div>
        {location.profile_control_status === "verified" && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary bg-accent rounded-full px-2.5 py-1">
            <BadgeCheck className="w-3.5 h-3.5" /> Verificat de Vezunde
          </span>
        )}
        {location.profile_control_status === "claimed" && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground bg-secondary rounded-full px-2.5 py-1">Profil revendicat</span>
        )}
        {location.profile_control_status === "directory" && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground bg-secondary rounded-full px-2.5 py-1">Profil din director</span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{location.city}</span>
        {location.availability_label && (
          <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{location.availability_label}</span>
        )}
        {location.phone && (
          <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{location.phone}</span>
        )}
      </div>
      {shown.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {shown.map((s) => (
            <span key={s.key} className="text-xs bg-secondary text-secondary-foreground rounded-full px-2.5 py-1">{s.label}</span>
          ))}
          {publicServices.length > 3 && (
            <span className="text-xs text-muted-foreground px-1 py-1">+{publicServices.length - 3} servicii</span>
          )}
        </div>
      )}
    </Link>
  );
}