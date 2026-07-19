import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import {
  CLAIMANT_RELATIONSHIPS,
  REQUESTED_ROLE_LABELS,
  requestedRoleForClaimScope,
} from "@/components/provider/ContactIdentityFields";
import { CLAIM_SCOPE_LABELS } from "@/lib/providerClaimScope";

function locationSummary(location) {
  return [location?.name, location?.city, location?.address].filter(Boolean).join(" · ");
}

export default function ClaimReviewStep({ locationCard, contact, scope, options, error, submitting, onSubmit }) {
  const requestedRole = requestedRoleForClaimScope(contact.claimant_relationship, scope.claim_scope);
  const candidateById = new Map((options?.candidate_locations || []).map((location) => [location.id, location]));
  const includedLocations = (scope.requested_location_ids || []).map((id) => candidateById.get(id)).filter(Boolean);
  const excludedLocations = (scope.excluded_location_ids || []).map((id) => candidateById.get(id)).filter(Boolean);

  return (
    <div className="text-left">
      <div className="mb-3">{locationCard}</div>
      <div className="space-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nume</span><span className="text-right font-medium">{contact.contact_name}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Relatie</span><span className="text-right font-medium">{CLAIMANT_RELATIONSHIPS[contact.claimant_relationship] || "—"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Tip solicitare</span><span className="text-right font-medium">{CLAIM_SCOPE_LABELS[scope.claim_scope] || "O singura locatie"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Acces solicitat</span><span className="text-right font-medium">{REQUESTED_ROLE_LABELS[requestedRole]}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email privat</span><span className="break-all text-right font-medium">{contact.email}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Telefon privat</span><span className="text-right font-medium">{contact.phone || "—"}</span></div>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-secondary/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Locatii incluse</h3>
          <span className="rounded-full bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground">{includedLocations.length}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {includedLocations.map((location) => (
            <li key={location.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground">{locationSummary(location)}</li>
          ))}
        </ul>
        {excludedLocations.length > 0 && (
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-semibold">{excludedLocations.length} locatii marcate ca neincluse</summary>
            <ul className="mt-2 space-y-1.5">
              {excludedLocations.map((location) => <li key={location.id}>• {locationSummary(location)}</li>)}
            </ul>
          </details>
        )}
        {scope.reported_missing_location && (
          <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Locatie lipsa raportata:</span> {scope.reported_missing_location}
          </div>
        )}
      </section>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        VIASEE verifica fiecare locatie separat. Aprobarea nu acorda acces la locatii neconfirmate, excluse sau adaugate ulterior. Profilurile nu sunt modificate automat inainte de decizia administrativa.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} loading={submitting}>Trimite spre verificare</ContinueButton>
    </div>
  );
}
