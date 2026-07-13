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

function requestedRoleForClaim(claim) {
  const payload = parsePayload(claim.submitted_payload);
  return claim.requested_membership_role
    || payload.requested_membership_role
    || ROLE_BY_RELATIONSHIP[claim.claimant_relationship]
    || "location_staff";
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
    <AdminCard className="p-5">
      {!claims && <p className="text-muted-foreground text-sm">Se incarca...</p>}
      {claims && claims.length === 0 && (
        <EmptyState icon={FileCheck2} title="Nicio revendicare in asteptare." subtitle="Cererile de revendicare a profilurilor vor aparea aici." />
      )}
      {claims && claims.length > 0 && (
        <div className="space-y-2">
          {claims.map((claim) => {
            const location = locations[claim.location_id];
            const payload = parsePayload(claim.submitted_payload);
            const isDuplicateReview = claim.mode === "new_location_duplicate_review";
            const isAccessRequest = payload.request_type === "access_request_existing_claimed_profile";
            const modeLabel = isDuplicateReview
              ? "locatie noua — verificare duplicat"
              : isAccessRequest
                ? "solicitare acces profil administrat"
                : claim.mode || "claim";
            const requestedRole = requestedRoleForClaim(claim);
            const defaultApprovedRole = approvalDefaultForClaim(claim, requestedRole);
            const canReview = REVIEWABLE_STATUSES.has(claim.status);
            return (
              <div key={claim.id} className="bg-secondary/50 border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-semibold text-sm">{claim.business_name || location?.name || "Fara nume"}</div>
                    <div className="text-xs text-muted-foreground">
                      {location ? `${location.name}, ${location.city}` : isDuplicateReview ? "propunere de locatie (necreata)" : "locatie noua / necunoscuta"} · {claim.contact_name} · {claim.email}{claim.phone ? ` · ${claim.phone}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Mod: {modeLabel} · Relatie: {claim.claimant_relationship || "—"} · Acces solicitat: {ROLE_LABELS[requestedRole] || requestedRole}
                    </div>
                    {claim.approved_membership_role && (
                      <div className="text-xs text-muted-foreground mt-1">Acces aprobat: {ROLE_LABELS[claim.approved_membership_role] || claim.approved_membership_role}</div>
                    )}
                    {claim.review_notes && <div className="text-xs text-muted-foreground mt-1">Nota: {claim.review_notes}</div>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${claim.status === "aprobata" ? "bg-green-100 text-green-800" : claim.status === "respinsa" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{claim.status}</span>
                  {canReview && (
                    <div className="flex gap-2">
                      {!isDuplicateReview && (
                        <button
                          onClick={() => setAction({
                            claimId: claim.id,
                            type: "approve",
                            requestedRole,
                            approvedRole: defaultApprovedRole,
                            isAccessRequest,
                          })}
                          className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold"
                        >
                          Aproba
                        </button>
                      )}
                      <button onClick={() => setAction({ claimId: claim.id, type: "reject" })} className="text-xs px-3 py-1.5 rounded-md bg-card border border-border text-destructive">Respinge</button>
                    </div>
                  )}
                </div>
                <AdminClaimIdentityContext claim={claim} />
                {isDuplicateReview && canReview && (
                  <p className="mt-2 text-xs text-muted-foreground">
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
              <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                Acces solicitat: <span className="font-semibold text-foreground">{ROLE_LABELS[action.requestedRole]}</span>
                {action.isAccessRequest && (
                  <span className="mt-1 block">Profilul este deja administrat, de aceea rolul implicit este limitat. Acordarea rolului de owner trebuie aleasa explicit.</span>
                )}
              </div>
              <label htmlFor="approved-role" className="mt-3 block text-xs font-semibold text-muted-foreground">Rol acordat dupa aprobare</label>
              <select
                id="approved-role"
                value={action.approvedRole}
                onChange={(event) => setAction((current) => ({ ...current, approvedRole: event.target.value }))}
                className="mt-2 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Adminul confirma rolul solicitat sau acorda un nivel diferit pe baza verificarii.</p>
            </div>
          )}
        </DirOpsActionNote>
      )}
    </AdminCard>
  );
}
