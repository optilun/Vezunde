import React, { useState } from "react";
import { Building2, ChevronDown, MapPin } from "lucide-react";

const ORGANIZATION_TYPE_LABELS = {
  optical_chain: "Lant de optici",
  independent_optical_store: "Optica",
  ophthalmology_clinic: "Clinica oftalmologica",
  ophthalmology_office: "Cabinet oftalmologic",
  healthcare_network: "Retea medicala",
  multi_specialty_healthcare_provider: "Furnizor multi-specialitate",
};

// Card de organizatie in cautarea de revendicare (2026-08-18). Porneste solicitarea de
// la brand, cu toate locatiile mapate propuse; verificarea VIASEE rămâne neschimbata.
export default function OrganizationSearchResult({ organization, onClaimOrganization, onClaimLocation }) {
  const [expanded, setExpanded] = useState(false);
  const typeLabel = ORGANIZATION_TYPE_LABELS[organization.organization_type] || "Organizatie";

  return (
    <div className="rounded-2xl border border-foreground/20 bg-card p-4 sm:rounded-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{typeLabel}</div>
          <div className="mt-0.5 break-words font-semibold leading-snug">{organization.name}</div>
          <div className="mt-1 text-sm leading-5 text-muted-foreground">
            {organization.location_count} locatii{organization.cities?.length ? ` · ${organization.cities.join(", ")}` : ""}
          </div>
          <div className="mt-2 text-xs leading-5 text-muted-foreground">
            Poti porni solicitarea pentru tot brandul. Fiecare locatie se confirma la pasul urmator.
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => onClaimOrganization(organization)}
          className="min-h-11 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:rounded-full sm:text-xs"
        >
          Administrez tot brandul
        </button>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40 sm:rounded-full sm:text-xs"
        >
          Vezi cele {organization.location_count} locatii
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {organization.locations.map((location) => (
            <li key={location.id} className="flex items-start justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block break-words text-sm font-semibold">{location.name}</span>
                <span className="mt-0.5 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {location.city}{location.address ? `, ${location.address}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onClaimLocation(location)}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-foreground/40"
              >
                Doar aceasta
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}