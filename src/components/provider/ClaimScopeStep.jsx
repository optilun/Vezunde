import React, { useMemo } from "react";
import { Building2, Check, MapPin, RefreshCw } from "lucide-react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import {
  CLAIM_SCOPE,
  CLAIM_SCOPE_DESCRIPTIONS,
  CLAIM_SCOPE_LABELS,
  isOrganizationRelationship,
  scopeDraftForChoice,
  validateClaimScopeDraft,
} from "@/lib/providerClaimScope";

function locationLabel(location) {
  return [location.city, location.address].filter(Boolean).join(", ") || "Adresa nepublicata";
}

export default function ClaimScopeStep({
  locationCard,
  options,
  scope,
  contact,
  loading,
  error,
  onChange,
  onRetry,
  onContinue,
}) {
  const candidates = options?.candidate_locations || [];
  const primaryId = options?.primary_location_id || "";
  const selectedIds = new Set(scope.requested_location_ids || []);
  const canRequestOrganization = Boolean(options?.supports_organization_claim)
    && isOrganizationRelationship(contact.claimant_relationship);
  const primary = candidates.find((item) => item.id === primaryId);
  const blockedPrimary = primary?.already_has_access === true;
  const validationError = options ? validateClaimScopeDraft(scope, options) : "";
  const organizationName = options?.organization?.name || "organizatia";

  const scopeChoices = useMemo(() => {
    /** @type {Array<{ value: string }>} */
    const choices = [{ value: CLAIM_SCOPE.LOCATION }];
    if (options?.supports_selected_locations) choices.push({ value: CLAIM_SCOPE.SELECTED_LOCATIONS });
    if (canRequestOrganization) choices.push({ value: CLAIM_SCOPE.ORGANIZATION });
    return choices;
  }, [canRequestOrganization, options?.supports_selected_locations]);

  const selectScope = (claimScope) => onChange(scopeDraftForChoice(claimScope, options, scope));

  const toggleLocation = (locationId) => {
    if (locationId === primaryId) return;
    const requested = new Set(scope.requested_location_ids || []);
    if (requested.has(locationId)) requested.delete(locationId);
    else requested.add(locationId);
    const requestedLocationIds = [...requested];
    const excludedLocationIds = candidates.map((item) => item.id).filter((id) => !requested.has(id));
    onChange({
      ...scope,
      requested_location_ids: requestedLocationIds,
      excluded_location_ids: excludedLocationIds,
    });
  };

  return (
    <div className="text-left">
      <div className="mb-5">{locationCard}</div>

      {loading && (
        <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Se incarca locatiile asociate...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold">
            <RefreshCw className="h-3.5 w-3.5" /> Reincearca
          </button>
        </div>
      )}

      {!loading && options && (
        <>
          {options.organization && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-secondary/40 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card"><Building2 className="h-4 w-4" /></span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-muted-foreground">Organizatie asociata</div>
                <div className="mt-0.5 break-words text-sm font-bold">{options.organization.name}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">VIASEE va verifica separat relatia organizatie-locatie si dreptul tau de administrare.</p>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {scopeChoices.map(({ value }) => (
              <ChoiceCard
                key={value}
                label={CLAIM_SCOPE_LABELS[value]}
                hint={CLAIM_SCOPE_DESCRIPTIONS[value]}
                selected={scope.claim_scope === value}
                onClick={() => selectScope(value)}
              />
            ))}
          </div>

          {options.organization && !canRequestOrganization && (
            <p className="mt-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Administrarea intregii organizatii este disponibila numai proprietarului sau reprezentantului autorizat. Poti solicita una sau mai multe locatii.
            </p>
          )}

          {blockedPrimary && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
              Ai deja acces la locatia principala. Revendicarea nu poate fi trimisa din nou pentru aceasta locatie.
            </p>
          )}

          {[CLAIM_SCOPE.SELECTED_LOCATIONS, CLAIM_SCOPE.ORGANIZATION].includes(scope.claim_scope) && candidates.length > 0 && (
            <section className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">Confirma locatiile</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Bifeaza locatiile pe care le reprezinti. Cele debifate sunt salvate explicit ca „nu apartine / nu o administrez”.
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{selectedIds.size} selectate</span>
              </div>

              <div className="mt-3 space-y-2">
                {candidates.map((location) => {
                  const selected = selectedIds.has(location.id);
                  const primaryLocation = location.id === primaryId;
                  const disabled = primaryLocation || location.already_has_access;
                  return (
                    <button
                      key={location.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleLocation(location.id)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${selected ? "border-foreground/35 bg-card" : "border-border bg-secondary/25"} ${disabled ? "cursor-default" : "hover:border-foreground/30"}`}
                    >
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}>
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words text-sm font-semibold">{location.name}</span>
                          {primaryLocation && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Locatie principala</span>}
                          {location.already_has_access && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Ai deja acces</span>}
                          {location.controlled && !location.already_has_access && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Profil administrat</span>}
                        </span>
                        <span className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {locationLabel(location)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {scope.claim_scope === CLAIM_SCOPE.ORGANIZATION && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Rolul de owner al {organizationName} va fi acordat numai pentru locatiile confirmate si aprobate. Locatiile viitoare nu intra automat in acces.
                </p>
              )}
            </section>
          )}

          <label className="mt-5 block">
            <span className="text-xs font-semibold text-muted-foreground">Lipseste o locatie din lista? (optional)</span>
            <textarea
              value={scope.reported_missing_location || ""}
              onChange={(event) => onChange({ ...scope, reported_missing_location: event.target.value.slice(0, 1000) })}
              rows={3}
              placeholder="Scrie numele, localitatea si adresa aproximativa. Locatia nu va fi adaugata automat; va intra in verificare."
              className="mt-2 w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:border-foreground/40 sm:text-sm"
            />
          </label>

          {validationError && !blockedPrimary && <p className="mt-3 text-xs text-destructive">{validationError}</p>}
          <ContinueButton onClick={onContinue} disabled={Boolean(validationError) || blockedPrimary}>
            Continua
          </ContinueButton>
        </>
      )}
    </div>
  );
}
