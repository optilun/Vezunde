import React, { useEffect, useState } from "react";
import { FileCheck2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminClaimIdentityContext from "@/components/admin/AdminClaimIdentityContext";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const ROLE_OPTIONS = [
  { value: "organization_owner", label: "Owner organizatie" },
  { value: "location_manager", label: "Manager locatie" },
  { value: "location_staff", label: "Membru locatie" },
];
const LOCATION_ROLE_OPTIONS = ROLE_OPTIONS.filter((item) => item.value !== "organization_owner");
const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((item) => [item.value, item.label]));
const ROLE_BY_RELATIONSHIP = {
  owner: "organization_owner",
  organization_representative: "organization_owner",
  location_manager: "location_manager",
  authorized_staff: "location_staff",
};
const SCOPE_LABELS = {
  location: "o locatie",
  selected_locations: "mai multe locatii",
  organization: "organizatie",
};
const REVIEWABLE_STATUSES = new Set(["in_asteptare", "needs_more_info"]);

function parsePayload(value) {
  try { return value ? JSON.parse(value) : {}; } catch (_error) { return {}; }
}

function parseSnapshot(value) {
  try { return value ? JSON.parse(value) : {}; } catch (_error) { return {}; }
}

function isLegacyLocationClaim(claim, payload = parsePayload(claim.submitted_payload)) {
  return !payload.scope_contract_version && (claim.mode === "claim" || payload.claim_scope === "location");
}

function requestedRoleForClaim(claim, scope) {
  if (scope?.requested_membership_role) return scope.requested_membership_role;
  const payload = parsePayload(claim.submitted_payload);
  const requestedRole = payload.requested_membership_role
    || ROLE_BY_RELATIONSHIP[claim.claimant_relationship]
    || "location_staff";
  return isLegacyLocationClaim(claim, payload) && requestedRole === "organization_owner"
    ? "location_manager"
    : requestedRole;
}

function approvalDefaultForClaim(claim, scope, requestedRole) {
  const payload = parsePayload(claim.submitted_payload);
  if (scope) return requestedRole;
  return payload.request_type === "access_request_existing_claimed_profile"
    ? "location_staff"
    : requestedRole;
}

function locationSummary(selection, locations) {
  const snapshot = parseSnapshot(selection.location_snapshot_json);
  const location = locations[selection.location_id] || {};
  return {
    id: selection.location_id,
    name: snapshot.name || location.public_display_name || location.name || "Locatie",
    city: snapshot.city || location.locality_name || location.city || "",
    address: snapshot.address || location.address || "",
    decision: selection.decision,
    requestStatus: selection.request_status,
    claimAction: selection.claim_action,
    linkStatus: selection.organization_link_status,
    controlled: selection.was_controlled === true,
  };
}

export default function DirOpsClaims() {
  const [claims, setClaims] = useState(null);
  const [locations, setLocations] = useState({});
  const [scopeByClaim, setScopeByClaim] = useState({});
  const [selectionsByClaim, setSelectionsByClaim] = useState({});
  const [action, setAction] = useState(null);

  const load = async () => {
    const [claimRows, locationRows, scopeRows, selectionRows] = await Promise.all([
      base44.entities.ProviderClaimRequest.list("-created_date", 300),
      base44.entities.ProviderLocation.list(null, 1500),
      base44.entities.ProviderClaimScopeSelection.list("-created_date", 500).catch(() => []),
      base44.entities.ProviderClaimLocationSelection.list("created_date", 3000).catch(() => []),
    ]);
    setClaims(claimRows);
    setLocations(Object.fromEntries(locationRows.map((location) => [location.id, location])));
    const nextScopes = {};
    for (const scope of scopeRows) {
      if (scope.selection_status !== "active" || nextScopes[scope.claim_request_id]) continue;
      nextScopes[scope.claim_request_id] = scope;
    }
    const nextSelections = {};
    for (const selection of selectionRows) {
      if (selection.selection_status !== "active") continue;
      if (!nextSelections[selection.claim_request_id]) nextSelections[selection.claim_request_id] = [];
      nextSelections[selection.claim_request_id].push(selection);
    }
    setScopeByClaim(nextScopes);
    setSelectionsByClaim(nextSelections);
  };

  useEffect(() => { load(); }, []);

  const run = async (note) => {
    const scoped = action.scoped === true;
    const functionName = scoped ? "adminProviderScopedClaimReview" : "adminProviderClaimReview";
    const response = await base44.functions.invoke(functionName, {
      action: action.type,
      claim_id: action.claimId,
      note,
      ...(action.type === "approve" ? {
        approved_role: action.approvedRole,
        ...(scoped ? { approved_location_ids: action.approvedLocationIds } : {}),
      } : {}),
    });
    if (response.data?.error) throw new Error(response.data.error);
    setAction(null);
    await load();
  };

  return (
    <div data-admin-mobile="true">
      <AdminCard className="overflow-hidden p-3 sm:p-5">
        {!claims && <p className="text-sm text-muted-foreground">Se incarca...</p>}
        {claims && claims.length === 0 && (
          <EmptyState icon={FileCheck2} title="Nicio revendicare in asteptare." subtitle="Cererile de revendicare a profilurilor vor aparea aici." />
        )}
        {claims && claims.length > 0 && (
          <div className="space-y-3">
            {claims.map((claim) => {
              const location = locations[claim.location_id];
              const payload = parsePayload(claim.submitted_payload);
              const scope = scopeByClaim[claim.id] || null;
              const selections = selectionsByClaim[claim.id] || [];
              const includedSelections = selections.filter((item) => item.decision === "included");
              const excludedSelections = selections.filter((item) => item.decision === "excluded");
              const isDuplicateReview = claim.mode === "new_location_duplicate_review";
              const isAccessRequest = String(payload.request_type || "").includes("access_request");
              const legacyLocationScoped = isLegacyLocationClaim(claim, payload);
              const scoped = Boolean(scope);
              const claimScope = scope?.claim_scope || (legacyLocationScoped ? "location" : payload.claim_scope || "");
              const modeLabel = isDuplicateReview
                ? "locatie noua — verificare duplicat"
                : scoped
                  ? `revendicare ${SCOPE_LABELS[claimScope] || claimScope}`
                  : isAccessRequest
                    ? "solicitare acces la locatie administrata"
                    : legacyLocationScoped
                      ? "revendicare locatie"
                      : claim.mode || "claim";
              const requestedRole = requestedRoleForClaim(claim, scope);
              const approvedRole = scope?.approved_membership_role || payload.approved_membership_role || "";
              const defaultApprovedRole = approvalDefaultForClaim(claim, scope, requestedRole);
              const canReview = REVIEWABLE_STATUSES.has(claim.status);
              const includedIds = includedSelections.map((item) => item.location_id);
              const summarizedSelections = selections.map((selection) => locationSummary(selection, locations));
              return (
                <div key={claim.id} className="rounded-2xl border border-border bg-secondary/50 p-3.5 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-semibold">{claim.business_name || location?.name || "Fara nume"}</div>
                      <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                        {location ? `${location.name}, ${location.city}` : isDuplicateReview ? "propunere de locatie (necreata)" : "locatie noua / necunoscuta"} · {claim.contact_name} · {claim.email}{claim.phone ? ` · ${claim.phone}` : ""}
                      </div>
                      <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                        Mod: {modeLabel} · Relatie: {claim.claimant_relationship || "—"} · Acces solicitat: {ROLE_LABELS[requestedRole] || requestedRole}
                      </div>
                      {scoped && (
                        <div className="mt-1 text-xs font-medium text-amber-800">
                          {includedSelections.length} {includedSelections.length === 1 ? "locatie solicitata" : "locatii solicitate"} · {excludedSelections.length} excluse explicit. Aprobarea poate fi partiala.
                        </div>
                      )}
                      {legacyLocationScoped && !scoped && (
                        <div className="mt-1 text-xs font-medium text-amber-800">
                          Cererea este limitata la locatia selectata si nu poate acorda administrarea organizatiei.
                        </div>
                      )}
                      {approvedRole && (
                        <div className="mt-1 text-xs text-muted-foreground">Acces aprobat: {ROLE_LABELS[approvedRole] || approvedRole}{scope ? ` · ${scope.approved_location_count || 0} locatii` : ""}</div>
                      )}
                      {claim.review_notes && <div className="mt-1 break-words text-xs text-muted-foreground">Nota: {claim.review_notes}</div>}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${claim.status === "aprobata" ? "bg-green-100 text-green-800" : claim.status === "respinsa" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{claim.status}</span>
                      {canReview && (
                        <div className={`grid w-full gap-2 sm:flex sm:w-auto ${scoped ? "grid-cols-3" : "grid-cols-2"}`}>
                          {!isDuplicateReview && (
                            <button
                              type="button"
                              onClick={() => setAction({
                                claimId: claim.id,
                                type: "approve",
                                scoped,
                                claimScope,
                                requestedRole,
                                approvedRole: defaultApprovedRole,
                                isAccessRequest,
                                locationScoped: claimScope !== "organization",
                                includedLocations: summarizedSelections.filter((item) => item.decision === "included"),
                                approvedLocationIds: includedIds,
                                primaryLocationId: scope?.primary_location_id || claim.location_id,
                                excludedCount: excludedSelections.length,
                                candidateCount: selections.length,
                              })}
                              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground sm:min-h-9 sm:rounded-md sm:px-3"
                            >
                              Aproba
                            </button>
                          )}
                          {scoped && (
                            <button
                              type="button"
                              onClick={() => setAction({ claimId: claim.id, type: "request_more_info", scoped: true })}
                              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-3 text-xs font-semibold sm:min-h-9 sm:rounded-md"
                            >
                              Cere detalii
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setAction({ claimId: claim.id, type: "reject", scoped })}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-semibold text-destructive sm:min-h-9 sm:rounded-md sm:px-3"
                          >
                            Respinge
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {scoped && summarizedSelections.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {summarizedSelections.map((item) => (
                        <div key={item.id} className={`rounded-xl border px-3 py-2.5 ${item.decision === "included" ? "border-border bg-card" : "border-border/70 bg-secondary/40 opacity-75"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="break-words text-xs font-semibold">{item.name}</div>
                              <div className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{[item.city, item.address].filter(Boolean).join(", ") || "Adresa indisponibila"}</div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.decision === "included" ? "bg-green-100 text-green-800" : "bg-secondary text-muted-foreground"}`}>{item.decision === "included" ? item.requestStatus : "exclusa"}</span>
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{item.claimAction === "request_access" ? "profil administrat" : "profil director"} · legatura {item.linkStatus || "necunoscuta"}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <AdminClaimIdentityContext claim={claim} />
                  {isDuplicateReview && canReview && (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      Nicio locatie nu a fost creata. Daca este distincta, creeaz-o prin fluxul canonic „Adauga locatie”, apoi inchide cererea cu o nota.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {action && (
          <DirOpsActionNote
            title={action.type === "approve" ? "Aproba solicitarea si accesul" : action.type === "request_more_info" ? "Solicita informatii suplimentare" : "Respinge solicitarea"}
            noteOptional={action.type === "approve"}
            onConfirm={run}
            onCancel={() => setAction(null)}
          >
            {action.type === "approve" && (
              <div>
                <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Acces solicitat: <span className="font-semibold text-foreground">{ROLE_LABELS[action.requestedRole]}</span>
                  {action.isAccessRequest && <span className="mt-1 block">Cel putin un profil este deja administrat; accesul ramane supus verificarii.</span>}
                  {action.locationScoped && <span className="mt-1 block font-medium text-amber-800">Acest scope nu poate acorda rol de owner al organizatiei.</span>}
                  {action.claimScope === "organization" && action.excludedCount > 0 && (
                    <span className="mt-1 block font-medium text-amber-800">Exista locatii excluse. Chiar cu rol de owner, accesul ramane limitat la locatiile aprobate si nu poate fi sincronizat automat la intreaga organizatie.</span>
                  )}
                </div>

                {action.scoped && action.includedLocations?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-muted-foreground">Locatii aprobate</div>
                    <div className="mt-2 space-y-2">
                      {action.includedLocations.map((item) => {
                        const checked = action.approvedLocationIds.includes(item.id);
                        const primary = item.id === action.primaryLocationId;
                        return (
                          <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={primary}
                              onChange={(event) => setAction((current) => ({
                                ...current,
                                approvedLocationIds: event.target.checked
                                  ? [...new Set([...current.approvedLocationIds, item.id])]
                                  : current.approvedLocationIds.filter((id) => id !== item.id),
                              }))}
                              className="mt-0.5 h-4 w-4"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words font-semibold text-foreground">{item.name}{primary ? " · principala" : ""}</span>
                              <span className="mt-0.5 block break-words text-muted-foreground">{[item.city, item.address].filter(Boolean).join(", ")}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label htmlFor="approved-role" className="mt-3 block text-xs font-semibold text-muted-foreground">Rol acordat dupa aprobare</label>
                <select
                  id="approved-role"
                  value={action.approvedRole}
                  onChange={(event) => setAction((current) => ({ ...current, approvedRole: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-base sm:min-h-10 sm:rounded-md sm:text-sm"
                >
                  {(action.claimScope === "organization" ? ROLE_OPTIONS : LOCATION_ROLE_OPTIONS).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Adminul confirma rolul si poate elimina locatii din aprobarea finala. Nu se poate adauga o locatie care nu a fost solicitata.</p>
              </div>
            )}
          </DirOpsActionNote>
        )}
      </AdminCard>
    </div>
  );
}
