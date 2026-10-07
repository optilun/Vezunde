import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileCheck2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminClaimIdentityContext from "@/components/admin/AdminClaimIdentityContext";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminTabs from "@/components/admin/ui/AdminTabs";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { useAdminSubTab } from "@/components/admin/useAdminRoute";
import { adminHref } from "@/lib/adminNavConfig";
import {
  claimRelationshipLabel,
  claimStatusLabel,
  claimStatusTone,
  organizationLinkLabel,
  selectionRequestLabel,
  selectionRequestTone,
} from "@/lib/adminLabels";
import { fetchByIds, uniqueIds } from "@/lib/adminEntityBatch";
import { plural, relativeTime } from "@/lib/adminFormat";

// 2026-10-03 (structura conturilor, pasul 3): fara „owner selectiv”. Proprietarul se aproba doar
// cu toate locatiile organizatiei; altfel serverul refuza si cere Manager locatie.
const ROLE_OPTIONS = [
  { value: "organization_owner", label: "Proprietar (toată organizația)" },
  { value: "location_manager", label: "Manager locație" },
  { value: "location_staff", label: "Membru" },
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
  location: "o locație",
  selected_locations: "mai multe locații",
  organization: "organizație",
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

// 2026-10-02. Aceeasi regula ca adminProviderClaimReview / adminProviderScopedClaimReview:
// rolul de owner se poate acorda doar la o cerere pentru organizatie sau la o locatie noua
// (cererea creeaza si organizatia). Revendicarea unei locatii existente ramane la roluri de locatie.
function ownerRoleAllowed(claim, scope, payload = parsePayload(claim.submitted_payload)) {
  if (scope) return scope.claim_scope === "organization";
  return !(claim.mode === "claim" || payload.claim_scope === "location");
}

// Valoarea implicita trebuie sa fie mereu una din optiunile afisate; altfel dialogul arata un
// rol si trimite altul (vezi testul E2E din 2026-10-02).
function roleInOptions(role, options) {
  return options.some((option) => option.value === role) ? role : options[0]?.value || "";
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
    name: snapshot.name || location.public_display_name || location.name || "Locație",
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
  const { refresh: refreshCounts } = useAdminCounts();
  const [view, setView] = useAdminSubTab(["de_rezolvat", "istoric"], "de_rezolvat");
  const [locationsFailed, setLocationsFailed] = useState(false);
  const [claims, setClaims] = useState(null);
  const [locations, setLocations] = useState({});
  const [scopeByClaim, setScopeByClaim] = useState({});
  const [selectionsByClaim, setSelectionsByClaim] = useState({});
  const [action, setAction] = useState(null);

  // 2026-10-07 (audit admin): nu mai citeste primele 1.500 de locatii (directorul are ~1.600, deci
  // cererile pentru restul apareau cu „locatie noua / necunoscuta”). Se citesc doar locatiile
  // pomenite de cereri, de selectiile lor si de sugestiile de retea.
  const load = async () => {
    const [claimRows, scopeRows, selectionRows] = await Promise.all([
      base44.entities.ProviderClaimRequest.list("-created_date", 300),
      base44.entities.ProviderClaimScopeSelection.list("-created_date", 500).catch(() => []),
      base44.entities.ProviderClaimLocationSelection.list("created_date", 3000).catch(() => []),
    ]);
    const networkIds = claimRows.flatMap((claim) => {
      const payload = parsePayload(claim.submitted_payload);
      return payload.network_suggestion_accepted === true && Array.isArray(payload.network_suggested_location_ids)
        ? payload.network_suggested_location_ids
        : [];
    });
    const { byId, failed } = await fetchByIds(
      base44.entities.ProviderLocation,
      uniqueIds(claimRows.map((claim) => claim.location_id), selectionRows.map((selection) => selection.location_id), networkIds),
    );
    setClaims(claimRows);
    setLocations(byId);
    setLocationsFailed(failed);
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
    const approving = action.type === "approve" || action.type === "approve_distinct";
    let response;
    try {
      response = await base44.functions.invoke(functionName, {
        action: action.type,
        claim_id: action.claimId,
        note,
        ...(approving ? {
          approved_role: action.approvedRole,
          ...(scoped ? { approved_location_ids: action.approvedLocationIds } : {}),
        } : {}),
        ...(action.type === "approve_distinct" ? { acknowledged_candidate_ids: action.acknowledgedIds || [] } : {}),
      });
    } catch (error) {
      // 2026-10-02. Duplicatele aparute dupa trimitere opresc aprobarea; adminul le vede aici si
      // le poate confirma explicit (bifa de mai jos), apoi apasa din nou pe Confirma.
      const data = error.response?.data;
      if (data?.code === "new_duplicate_candidates") {
        setAction((current) => ({ ...current, newCandidates: data.candidates || [] }));
      }
      throw error;
    }
    if (response.data?.code === "new_duplicate_candidates") {
      setAction((current) => ({ ...current, newCandidates: response.data.candidates || [] }));
    }
    if (response.data?.error) throw new Error(response.data.error);
    setAction(null);
    await load();
    refreshCounts();
  };

  // „De rezolvat”: cele in asteptare, cele mai vechi primele (sa nu astepte nimeni mai mult decat
  // trebuie). „Istoric”: restul, cele mai noi primele.
  const pendingClaims = (claims || [])
    .filter((claim) => REVIEWABLE_STATUSES.has(claim.status))
    .sort((a, b) => (a.status === b.status ? String(a.created_date).localeCompare(String(b.created_date)) : a.status === "in_asteptare" ? -1 : 1));
  const historyClaims = (claims || []).filter((claim) => !REVIEWABLE_STATUSES.has(claim.status));
  const shownClaims = view === "istoric" ? historyClaims : pendingClaims;
  const waitingNow = (claims || []).filter((claim) => claim.status === "in_asteptare").length;

  return (
    <div data-admin-mobile="true" className="space-y-4">
      {claims && (
        <AdminTabs
          label="Revendicări"
          value={view}
          onChange={setView}
          tabs={[
            { key: "de_rezolvat", label: "De rezolvat", count: waitingNow },
            { key: "istoric", label: "Istoric" },
          ]}
        />
      )}
      {locationsFailed && (
        <p role="alert" className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning">
          Unele locații nu s-au putut încărca, deci pot apărea cu nume lipsă. Reîncarcă pagina.
        </p>
      )}
      <AdminCard className="overflow-hidden p-3 sm:p-5">
        {!claims && <AdminLoading label="Se încarcă revendicările…" />}
        {claims && shownClaims.length === 0 && (
          <EmptyState
            icon={FileCheck2}
            title={view === "istoric" ? "Nicio revendicare în istoric." : "Nicio revendicare de rezolvat."}
            subtitle={view === "istoric" ? "" : "Cererile de revendicare a profilurilor vor apărea aici."}
          />
        )}
        {claims && shownClaims.length > 0 && (
          <div className="space-y-3">
            {shownClaims.map((claim) => {
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
                ? "Locație nouă — verificare duplicat"
                : scoped
                  ? `Revendicare: ${SCOPE_LABELS[claimScope] || claimScope}`
                  : isAccessRequest
                    ? "Acces la o locație deja administrată"
                    : legacyLocationScoped
                      ? "Revendicare de locație"
                      : claim.mode === "new_location"
                        ? "Locație nouă"
                        : "Revendicare";
              const requestedRole = requestedRoleForClaim(claim, scope);
              const approvedRole = scope?.approved_membership_role || payload.approved_membership_role || "";
              const canGrantOwner = ownerRoleAllowed(claim, scope, payload);
              const roleOptions = canGrantOwner ? ROLE_OPTIONS : LOCATION_ROLE_OPTIONS;
              const defaultApprovedRole = roleInOptions(approvalDefaultForClaim(claim, scope, requestedRole), roleOptions);
              const canReview = REVIEWABLE_STATUSES.has(claim.status);
              const includedIds = includedSelections.map((item) => item.location_id);
              const summarizedSelections = selections.map((selection) => locationSummary(selection, locations));
              return (
                <div key={claim.id} className="rounded-2xl border border-border bg-secondary/50 p-3.5 sm:p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="break-words text-sm font-semibold">{claim.business_name || location?.name || "Fără nume"}</div>
                      <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                        {location ? `${location.name}, ${location.city}` : isDuplicateReview ? "propunere de locație (încă necreată)" : "locație nouă / necunoscută"} · {claim.contact_name} · {claim.email}{claim.phone ? ` · ${claim.phone}` : ""}
                      </div>
                      <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                        {modeLabel} · {claimRelationshipLabel(claim.claimant_relationship)} · Acces cerut: {ROLE_LABELS[requestedRole] || requestedRole}
                      </div>
                      {scoped && (
                        <div className="mt-1 text-xs font-medium text-warning">
                          {plural(includedSelections.length, "locație cerută", "locații cerute")}
                          {excludedSelections.length > 0 ? ` · ${excludedSelections.length} excluse de furnizor` : ""} · aprobarea poate fi parțială
                        </div>
                      )}
                      {legacyLocationScoped && !scoped && (
                        <div className="mt-1 text-xs font-medium text-warning">
                          Limitată la locația selectată; nu poate acorda administrarea organizației.
                        </div>
                      )}
                      {approvedRole && (
                        <div className="mt-1 text-xs text-muted-foreground">Acces aprobat: {ROLE_LABELS[approvedRole] || approvedRole}{scope ? ` · ${plural(scope.approved_location_count || 0, "locație", "locații")}` : ""}</div>
                      )}
                      {claim.review_notes && <div className="mt-1 break-words text-xs text-muted-foreground">Notă: {claim.review_notes}</div>}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                      <StatusBadge label={claimStatusLabel(claim.status)} tone={claimStatusTone(claim.status)} className="w-fit" />
                      {claim.created_date && (
                        <span className="text-[11px] text-muted-foreground sm:text-right" title={String(claim.created_date)}>
                          Trimisă {relativeTime(claim.created_date)}
                        </span>
                      )}
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
                                roleOptions,
                                isAccessRequest,
                                locationScoped: !canGrantOwner,
                                includedLocations: summarizedSelections.filter((item) => item.decision === "included"),
                                approvedLocationIds: includedIds,
                                primaryLocationId: scope?.primary_location_id || claim.location_id,
                                excludedCount: excludedSelections.length,
                                candidateCount: selections.length,
                              })}
                              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground sm:min-h-9 sm:rounded-md sm:px-3"
                            >
                              Aprobă
                            </button>
                          )}
                          {isDuplicateReview && (
                            <button
                              type="button"
                              onClick={() => setAction({
                                claimId: claim.id,
                                type: "approve_distinct",
                                scoped: false,
                                requestedRole,
                                approvedRole: defaultApprovedRole,
                                roleOptions,
                                newCandidates: [],
                                acknowledgedIds: [],
                              })}
                              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-foreground bg-card px-3 text-xs font-semibold sm:min-h-9 sm:rounded-md"
                            >
                              Aprobă ca locație distinctă
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
                            onClick={() => setAction({ claimId: claim.id, type: "reject", scoped, duplicateReview: isDuplicateReview })}
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
                              <div className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{[item.city, item.address].filter(Boolean).join(", ") || "Adresă indisponibilă"}</div>
                            </div>
                            {item.decision === "included"
                              ? <StatusBadge label={selectionRequestLabel(item.requestStatus)} tone={selectionRequestTone(item.requestStatus)} className="shrink-0" />
                              : <StatusBadge label="Exclusă" tone="neutral" className="shrink-0" />}
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{item.claimAction === "request_access" ? "profil deja administrat" : "profil din director"} · {organizationLinkLabel(item.linkStatus)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <AdminClaimIdentityContext claim={claim} />
                  {/* 2026-10-03: sugestiile de retea bifate de furnizor erau salvate doar in payload, iar
                      adminul nu le vedea. Raman informative: nu intra in aprobare. */}
                  {payload.network_suggestion_accepted === true && Array.isArray(payload.network_suggested_location_ids) && payload.network_suggested_location_ids.length > 0 && (
                    <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs">
                      <div className="font-semibold">Furnizorul spune că aceste locații fac parte din aceeași rețea</div>
                      <ul className="mt-1.5 space-y-1 text-muted-foreground">
                        {payload.network_suggested_location_ids.map((locationId) => {
                          const suggested = locations[locationId] || {};
                          return (
                            <li key={locationId}>
                              <span className="font-medium text-foreground">{suggested.public_display_name || suggested.name || locationId}</span>
                              {[suggested.city || suggested.locality_name, suggested.address].filter(Boolean).length > 0 && ` · ${[suggested.city || suggested.locality_name, suggested.address].filter(Boolean).join(", ")}`}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="mt-1.5 text-muted-foreground">
                        Nu intră în această aprobare. Dacă legătura se confirmă, asociază-le din{" "}
                        <Link to={adminHref("import_directory", "mapping")} className="font-medium text-foreground underline underline-offset-2">Import director → Mapare și identitate</Link>.
                      </p>
                    </div>
                  )}
                  {isDuplicateReview && canReview && (
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      Nu s-a creat nicio locație încă. Dacă e o locație diferită: „Aprobă ca locație distinctă” (se creează ca ciornă nepublicată, iar furnizorul primește acces). Dacă e aceeași: respinge cererea și spune-i furnizorului ce să facă.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {action && (
          <DirOpsActionNote
            title={action.type === "approve" ? "Aprobă cererea și accesul" : action.type === "approve_distinct" ? "Aprobă ca locație distinctă" : action.type === "request_more_info" ? "Cere informații suplimentare" : "Respinge cererea"}
            noteOptional={action.type === "approve"}
            onConfirm={run}
            onCancel={() => setAction(null)}
          >
            {action.type === "approve_distinct" && (
              <div>
                <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Locația și organizația se creează din datele trimise, ca ciornă nepublicată și neverificată.
                  <span className="mt-1 block">Acces cerut: <span className="font-semibold text-foreground">{ROLE_LABELS[action.requestedRole] || action.requestedRole}</span></span>
                  <span className="mt-1 block font-medium text-foreground">Scrie mai jos de ce e o locație diferită (minim 15 caractere). Rămâne în istoric.</span>
                </div>

                {action.newCandidates?.length > 0 && (
                  <div className="mt-3 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning">
                    <div className="font-semibold">Locații asemănătoare apărute după trimiterea cererii</div>
                    <ul className="mt-2 space-y-1.5">
                      {action.newCandidates.map((candidate) => (
                        <li key={candidate.location_id}>
                          <span className="font-semibold">{candidate.name || "Locație fără nume"}</span>
                          {[candidate.organization_name, candidate.locality_name, candidate.address].filter(Boolean).length > 0 && ` · ${[candidate.organization_name, candidate.locality_name, candidate.address].filter(Boolean).join(" · ")}`}
                          {candidate.matched_fields?.length > 0 && <span className="block text-warning">Potrivire: {candidate.matched_fields.join(", ")}</span>}
                        </li>
                      ))}
                    </ul>
                    <label className="mt-2 flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0"
                        checked={action.newCandidates.every((candidate) => action.acknowledgedIds?.includes(candidate.location_id))}
                        onChange={(event) => setAction((current) => ({
                          ...current,
                          acknowledgedIds: event.target.checked
                            ? [...new Set([...(current.acknowledgedIds || []), ...current.newCandidates.map((candidate) => candidate.location_id)])]
                            : (current.acknowledgedIds || []).filter((id) => !current.newCandidates.some((candidate) => candidate.location_id === id)),
                        }))}
                      />
                      <span>Am verificat: sunt locații diferite de cea propusă.</span>
                    </label>
                  </div>
                )}

                <label htmlFor="approved-role" className="mt-3 block text-xs font-semibold text-muted-foreground">Rol acordat după aprobare</label>
                <select
                  id="approved-role"
                  value={action.approvedRole}
                  onChange={(event) => setAction((current) => ({ ...current, approvedRole: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-base sm:min-h-10 sm:rounded-md sm:text-sm"
                >
                  {(action.roleOptions || LOCATION_ROLE_OPTIONS).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            )}
            {action.type === "reject" && action.duplicateReview && (
              <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                Furnizorul vede motivul în contul lui. Dacă e aceeași locație, spune-i ce să facă: să revendice profilul existent (dacă e public) sau că propunerea există deja în verificare.
              </div>
            )}
            {action.type === "approve" && (
              <div>
                <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Acces cerut: <span className="font-semibold text-foreground">{ROLE_LABELS[action.requestedRole] || action.requestedRole}</span>
                  {action.isAccessRequest && <span className="mt-1 block">Cel puțin un profil e deja administrat; accesul rămâne supus verificării.</span>}
                  {action.locationScoped && <span className="mt-1 block font-medium text-warning">Cererea e limitată la o locație: nu poate acorda rolul de proprietar al organizației.</span>}
                  {action.claimScope === "organization" && action.excludedCount > 0 && (
                    <span className="mt-1 block font-medium text-warning">Există locații excluse: accesul rămâne limitat la cele aprobate și nu se extinde automat la toată organizația.</span>
                  )}
                </div>

                {action.scoped && action.includedLocations?.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-muted-foreground">Locații aprobate</div>
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
                              className="mt-0.5 h-4 w-4 shrink-0"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words font-semibold text-foreground">{item.name}{primary ? " · principală" : ""}</span>
                              <span className="mt-0.5 block break-words text-muted-foreground">{[item.city, item.address].filter(Boolean).join(", ")}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label htmlFor="approved-role" className="mt-3 block text-xs font-semibold text-muted-foreground">Rol acordat după aprobare</label>
                <select
                  id="approved-role"
                  value={action.approvedRole}
                  onChange={(event) => setAction((current) => ({ ...current, approvedRole: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-base sm:min-h-10 sm:rounded-md sm:text-sm"
                >
                  {(action.roleOptions || LOCATION_ROLE_OPTIONS).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Confirmi rolul și poți scoate locații din aprobare. Nu poți adăuga o locație care nu a fost cerută.</p>
              </div>
            )}
          </DirOpsActionNote>
        )}
      </AdminCard>
    </div>
  );
}
