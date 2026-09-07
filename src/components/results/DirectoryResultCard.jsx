import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, Phone, Map } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { typeVisual } from "./LocationThumb";
import TrustBadge from "./TrustBadge";

// Public directory information only. No paid rank or recommendation claims.
export default function DirectoryResultCard({ location, onShowMap }) {
  const { Icon } = typeVisual(location.provider_type);
  const city = String(location.city || "").trim();
  const address = String(location.address || "").trim();
  const addressLabel = address.toLocaleLowerCase("ro").includes(city.toLocaleLowerCase("ro"))
    ? address : [city, address].filter(Boolean).join(", ");
  return (
    <article className="directory-premium-card flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-border bg-card">
      <div className="directory-premium-cover relative flex h-28 items-center justify-between px-5" aria-hidden="true">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/65 text-[#4f6080] shadow-sm">
          <Icon className="h-7 w-7" strokeWidth={1.5} />
        </span>
        <span className="max-w-[60%] text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f6080]">{city || "VIASEE"}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.1em] text-[#4f6080]">{PROVIDER_TYPES[location.provider_type] || "Locație"}</p>
        <h3 className="mt-2 break-words font-heading text-lg font-bold leading-snug tracking-tight">
          <Link to={`/furnizor/${location.id}`} className="rounded-sm hover:underline focus-visible:outline focus-visible:outline-2">{location.name}</Link>
        </h3>
        <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{addressLabel || "Adresa nu este publicată"}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2"><TrustBadge status={location.profile_control_status} /></div>
        {location.service_coverage_status === "not_listed" && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Serviciile nu sunt încă listate sau confirmate.</p>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <Link to={`/furnizor/${location.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Vezi profilul <ArrowUpRight className="h-4 w-4" />
          </Link>
          {location.phone && <a href={`tel:${location.phone.replace(/\s/g, "")}`} aria-label={`Sună la ${location.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border hover:bg-secondary"><Phone className="h-4 w-4" /></a>}
        </div>
      </div>
      {onShowMap && <button type="button" onClick={onShowMap} className="flex min-h-12 w-full items-center justify-between border-t border-border px-5 text-sm font-medium text-[#4f6080] transition-colors hover:bg-[#f8f4ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]">
        Vezi pe hartă <Map className="h-4 w-4" />
      </button>}
    </article>
  );
}
