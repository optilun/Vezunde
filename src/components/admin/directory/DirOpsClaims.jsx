import React, { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
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
const REVIEWABLE_STATUSES = new Set(["in_asteptare", "needs_more_info"]);

function parsePayload(value) {
  try { return value ? JSON.parse(value) : {}; } catch (_error) { return {}; }
}

function isLocationScopedClaim(claim, payload = parsePayload(claim.submitted_payload)) {
  return claim.mode === "claim" || payload.claim_scope === "location";
}

function requestedRoleForClaim(claim) {
  const payload = parsePayload(claim.submitted_payload);
  const requestedRole = payload.requested_membership_role
    || ROLE_BY_RELATIONSHIP[claim.claimant_relationship]
    || "location_staff";
  return isLocationScopedClaim(claim, payload) && requestedRole === "organization_owner"
    ? "location_manager"
    : requestedRole;
}

function approvalDefaultForClaim(claim, requestedRole) {
  const payload = parsePayload(claim.submitted_payload);
  return payload.request_type === "access_request_existing_claimed_profile"
    ? "location_staff"
    : requestedRole;
}

export default function DirOpsClaims() {
  const [claims, setClaims] = useState(null);
  const [locations, setLocations] = useState({});
  const [action, setAction] = useState(null);

  const load = async () => {
    const [claimRows, locationRows] = await Promise.all([
      base44.entities.ProviderClaimRequest.list("-created_date", 200),
      base44.entities.ProviderLocation.list(null, 500),
    ]);
    setClaims(claimRows);
    setLocations(Object.fromEntries(locationRows.map((location) => [location.id, location])));
  };

  useEffect(() => { load(); }, []);

  const run = async (note) => {
    const response = await base44.functions.invoke("adminProviderClaimReview", {
      action: action.type === "approve" ? "approve" : "reject",
      claim_id: action.claimId,
      note,
      ...(action.type === "approve" ? { approved_role: action.approvedRole } : {}),
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
              const isDuplicateReview = claim.mode === "new_location_duplicate_review";
              const isAccessRequest = payload.request_type === "access_request_existing_claimed_profile";
              const locationScoped = isLocationScopedClaim(claim, payload);
              const modeLabel = isDuplicateReview
                ? "locatie noua — verificare duplicat"
                : isAccessRequest
                  ? "solicitare acces la locatie administrata"
                  : locationScoped
                    ? "revendicare locatie"
                    : claim.mode || "claim";
              const requestedRole = requestedRoleForClaim(claim);
              const approvedRole = payload.approved_membership_role || "";
              const defaultApprovedRole = approvalDefaultForClaim(claim, requestedRole);
              const canReview = REVIEWABLE_STATUSES.has(claim.status);
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
                      {locationScoped && (
                        <div className="mt-1 text-xs font-medium text-amber-800">
                          Cererea este limitata la locatia selectata si nu poate acorda administrarea organizatiei.
                        </div>
                      )}
                      {approvedRole && (
                        <div className="mt-1 text-xs text-muted-foreground">Acces aprobat: {ROLE_LABELS[approvedRole] || approvedRole}</div>
                      )}
                      {claim.review_notes && <div className="mt-1 break-words text-xs text-muted-foreground">Nota: {claim.review_notes}</div>}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${claim.status === "aprobata" ? "bg-green-100 text-green-800" : claim.status === "respinsa" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{claim.status}</span>
                      {canReview && (
                        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                          {!isDuplicateReview && (
                            <button
                              type="button"
                              onClick={() => setAction({
                                claimId: claim.id,
                                type: "approve",
                                requestedRole,
                                approvedRole: defaultApprovedRole,
                                isAccessRequest,
                                locationScoped,
                              })}
                              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground sm:min-h-9 sm:rounded-md sm:px-3"
                            >
                              Aproba
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setAction({ claimId: claim.id, type: "reject" })}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-semibold text-destructive sm:min-h-9 sm:rounded-md sm:px-3"
                          >
                            Respinge
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
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
            title={action.type === "approve" ? "Aproba solicitarea si accesul" : "Respinge solicitarea"}
            noteOptional={action.type === "approve"}
            onConfirm={run}
            onCancel={() => setAction(null)}
          >
            {action.type === "approve" && (
              <div>
                <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Acces solicitat: <span className="font-semibold text-foreground">{ROLE_LABELS[action.requestedRole]}</span>
                  {action.isAccessRequest && (
                    <span className="mt-1 block">Profilul este deja administrat, de aceea rolul implicit este limitat.</span>
                  )}
                  {action.locationScoped && (
                    <span className="mt-1 block font-medium text-amber-800">Aceasta aprobare este strict pentru locatie. Rolul de owner al organizatiei nu este disponibil in acest flux.</span>
                  )}
                </div>
                <label htmlFor="approved-role" className="mt-3 block text-xs font-semibold text-muted-foreground">Rol acordat dupa aprobare</label>
                <select
                  id="approved-role"
                  value={action.approvedRole}
                  onChange={(event) => setAction((current) => ({ ...current, approvedRole: event.target.value }))}
                  className="mt-2 min-h-11 w-full rounded-xl border border-input bg-card px-3 py-2 text-base sm:min-h-10 sm:rounded-md sm:text-sm"
                >
                  {(action.locationScoped ? LOCATION_ROLE_OPTIONS : ROLE_OPTIONS).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Adminul confirma rolul solicitat sau acorda un nivel diferit in limitele acestui tip de cerere.</p>
              </div>
            )}
          </DirOpsActionNote>
        )}
      </AdminCard>
    </div>
  );
}
