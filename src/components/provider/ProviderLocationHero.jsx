import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Image as ImageIcon, MapPin, Phone } from "lucide-react";
import TrustBadge from "@/components/results/TrustBadge";
import { PROVIDER_PROFILE_TYPES, PROVIDER_TYPES } from "@/lib/vezunde";

function initials(name = "") {
  return String(name || "V")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "V";
}

function normalizedName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("ro-RO");
}

function HeroContent({ profile, status, serviceCount, mapUrl }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const organizationName = profile.organization_name || profile.name;
  const organizationDiffers = normalizedName(organizationName) !== normalizedName(profile.name);
  const providerLabel = PROVIDER_PROFILE_TYPES[profile.provider_profile_type]
    || PROVIDER_TYPES[profile.provider_type]
    || "Furnizor medical";

  return (
    <div className="p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-sm">
          {profile.organization_logo_url && !logoFailed ? (
            <img
              src={profile.organization_logo_url}
              alt={`Logo ${organizationName}`}
              className="h-full w-full object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span className="font-heading text-sm font-black">{initials(organizationName)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {organizationDiffers && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Organizatie</div>
              <div className="mt-0.5 truncate text-sm font-bold text-foreground">{organizationName}</div>
            </div>
          )}

          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{profile.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{providerLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {[profile.city, profile.county].filter(Boolean).join(", ") || profile.city || "Romania"}
            </span>
            {status === "verified" && <TrustBadge status={status} label="Locatie verificata" />}
            {status !== "verified" && <TrustBadge status={status} />}
          </div>

          {serviceCount > 0 && (
            <div className="mt-4">
              <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
                {serviceCount} {serviceCount === 1 ? "serviciu disponibil" : "servicii disponibile"}
              </span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to={`/cerere?furnizor=${profile.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              Trimite o cerere <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {profile.phone_public && (
              <a href={`tel:${profile.phone_public.replace(/\s/g, "")}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-xs font-semibold hover:bg-secondary">
                <Phone className="h-3.5 w-3.5" /> Suna locatia
              </a>
            )}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-xs font-semibold hover:bg-secondary">
                <MapPin className="h-3.5 w-3.5" /> Vezi traseul
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProviderLocationHero({ profile, status, serviceCount, mapUrl }) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-border bg-card/70 shadow-sm">
      {profile.photo_url ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
          <HeroContent profile={profile} status={status} serviceCount={serviceCount} mapUrl={mapUrl} />
          <div className="relative aspect-video border-t border-border bg-secondary/35 lg:aspect-auto lg:min-h-[240px] lg:border-l lg:border-t-0">
            <img src={profile.photo_url} alt={`Fotografie ${profile.name}`} className="h-full w-full object-cover" />
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur-sm"><ImageIcon className="h-3 w-3" /> Fotografie locatie</span>
          </div>
        </div>
      ) : (
        <HeroContent profile={profile} status={status} serviceCount={serviceCount} mapUrl={mapUrl} />
      )}
    </section>
  );
}
