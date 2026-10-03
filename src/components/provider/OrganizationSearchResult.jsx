import React, { useId, useState } from "react";
import { Building2, ChevronDown, MapPin } from "lucide-react";

const ORGANIZATION_TYPE_LABELS = {
  optical_chain: "Lanț de optici",
  independent_optical_store: "Optică",
  ophthalmology_clinic: "Clinică oftalmologică",
  ophthalmology_office: "Cabinet oftalmologic",
  healthcare_network: "Rețea medicală",
  multi_specialty_healthcare_provider: "Furnizor multi-specialitate",
};

// Card de organizatie in cautarea de revendicare (2026-08-18). Porneste solicitarea de
// la brand, cu toate locatiile mapate propuse; verificarea VIASEE rămâne neschimbata.
export default function OrganizationSearchResult({ organization, onClaimOrganization, onClaimLocation }) {
  const [expanded, setExpanded] = useState(false);
  const locationsId = useId();
  const typeLabel = ORGANIZATION_TYPE_LABELS[organization.organization_type] || null;

  return (
    <div data-organization-result={organization.id} className="min-w-0 rounded-2xl border border-[#405AE9]/25 bg-[#F8FAFF] p-4 sm:rounded-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Building2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Organizație{typeLabel ? ` · ${typeLabel}` : ""}</div>
          <div className="mt-0.5 break-words font-semibold leading-snug">{organization.name}</div>
          <div className="mt-1 text-sm leading-5 text-muted-foreground">
            {organization.location_count} locații{organization.cities?.length ? ` · ${organization.cities.join(", ")}` : ""}
          </div>
          <div className="mt-2 text-xs leading-5 text-muted-foreground">
            O singură solicitare pentru organizație. Alegi locațiile și confirmi legătura în pașii următori.
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={() => onClaimOrganization(organization)}
          className="min-h-11 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:rounded-full sm:text-xs"
        >
          Administrez organizația
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={locationsId}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:border-foreground/40 sm:rounded-full sm:text-xs"
        >
          {expanded ? "Ascunde locațiile" : `Vezi cele ${organization.location_count} locații`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <ul id={locationsId} className="mt-3 max-h-96 overflow-y-auto divide-y divide-border border-t border-border" aria-label={`Locațiile organizației ${organization.name}`}>
          {organization.locations.map((location) => (
            <li key={location.id} className="flex flex-col items-start gap-2 py-3 sm:flex-row sm:justify-between sm:gap-3">
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
                aria-label={`${location.claim_action === "request_access" ? "Solicită acces la" : "Revendică"} ${location.name}`}
                className="min-h-11 shrink-0 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:border-foreground/40"
              >
                {location.claim_action === "request_access" ? "Solicită acces" : "Doar această locație"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}