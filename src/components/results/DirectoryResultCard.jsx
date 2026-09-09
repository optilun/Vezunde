import { publicPhoneLink } from "../../../shared/publicPhoneLink.js";
import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, MapPin, Phone, Map } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { typeVisual } from "./LocationThumb";
import TrustBadge from "./TrustBadge";

// Public directory information only. No paid rank or recommendation claims.
export default function DirectoryResultCard({ location, onShowMap }) {
  const phoneHref = publicPhoneLink(location.phone);
  const { Icon } = typeVisual(location.provider_type);
  const city = String(location.city || "").trim();
  const address = String(location.address || "").trim();
  const addressLabel = address.toLocaleLowerCase("ro").includes(city.toLocaleLowerCase("ro"))
    ? address : [city, address].filter(Boolean).join(", ");
  return (
    <article className="directory-premium-card flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="directory-premium-cover flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/80 text-[#4f6080]">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-snug text-[#4f6080]">{PROVIDER_TYPES[location.provider_type] || "Locație"}</p>
          {city && <p className="mt-1 text-xs leading-snug text-muted-foreground">{city}</p>}
        </div>
      </div>

      <h3 className="mt-4 break-words font-heading text-[17px] font-bold leading-snug tracking-tight sm:text-lg">
        <Link to={`/furnizor/${location.id}`} className="rounded-sm transition-colors hover:text-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{location.name}</Link>
      </h3>
      <p className="mt-2.5 flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
        <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#4f6080]/70" /><span className="min-w-0 break-words">{addressLabel || "Adresa nu este publicată"}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2"><TrustBadge status={location.profile_control_status} className="max-w-full whitespace-normal" /></div>
      {location.service_coverage_status === "not_listed" && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Serviciile nu sunt încă listate sau confirmate.</p>}

      <div className="mt-auto pt-4">
        <div className="flex items-center gap-2 border-t border-border/70 pt-3">
          <Link to={`/furnizor/${location.id}`} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-[#4f6080] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            Vezi profilul <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
          {onShowMap && <button type="button" onClick={onShowMap} aria-label={`Vezi pe hartă: ${location.name}`} title="Vezi pe hartă" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d8dee8] bg-[#eff1f5]/70 text-[#4f6080] transition-colors hover:bg-[#dce4f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
            <Map aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>}
          {phoneHref && <a href={phoneHref} aria-label={`Sună la ${location.name}`} title="Sună" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-[#4f6080] transition-colors hover:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><Phone aria-hidden="true" className="h-4 w-4" /></a>}
        </div>
      </div>
    </article>
  );
}
