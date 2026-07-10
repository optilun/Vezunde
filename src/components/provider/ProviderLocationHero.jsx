import React from "react";
import { MapPin, Phone } from "lucide-react";
import TrustBadge from "@/components/results/TrustBadge";
import { PROVIDER_TYPES } from "@/lib/vezunde";

function HeroContent({ profile, status, publicServiceCount, categoryLabel, mapUrl }) {
  return (
    <div className="p-6 sm:p-7">
      <div className="text-xs font-medium text-primary">{PROVIDER_TYPES[profile.provider_type]}</div>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{profile.name}</h1>
        <TrustBadge status={status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{[profile.city, profile.county].filter(Boolean).join(", ") || profile.city || "România"}</span>
        {publicServiceCount > 0 && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-foreground">{publicServiceCount} {categoryLabel}</span>}
      </div>
      {(profile.phone_public || mapUrl) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {profile.phone_public && (
            <a href={`tel:${profile.phone_public.replace(/\s/g, "")}`} className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-opacity hover:opacity-90">
              <Phone className="h-3.5 w-3.5" /> Sună locația
            </a>
          )}
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-secondary">
              <MapPin className="h-3.5 w-3.5" /> Vezi traseul
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProviderLocationHero({ profile, status, publicServiceCount, categoryLabel, mapUrl }) {
  return (
    <section className="overflow-hidden rounded-[32px] border border-border bg-card/70 shadow-sm">
      {profile.photo_url ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
          <HeroContent profile={profile} status={status} publicServiceCount={publicServiceCount} categoryLabel={categoryLabel} mapUrl={mapUrl} />
          <div className="aspect-video border-t border-border bg-secondary/35 lg:aspect-auto lg:min-h-[230px] lg:border-l lg:border-t-0">
            <img src={profile.photo_url} alt={`Fotografie ${profile.name}`} className="h-full w-full object-cover" />
          </div>
        </div>
      ) : (
        <HeroContent profile={profile} status={status} publicServiceCount={publicServiceCount} categoryLabel={categoryLabel} mapUrl={mapUrl} />
      )}
    </section>
  );
}
