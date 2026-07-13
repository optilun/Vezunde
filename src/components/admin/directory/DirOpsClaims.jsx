import React, { useEffect, useMemo, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminClaimIdentityContext from "@/components/admin/AdminClaimIdentityContext";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const ROLE_LABELS = {
  organization_owner: "Owner organizatie",
  location_manager: "Manager locatie",
  location_staff: "Membru locatie",
};
const ROLE_BY_RELATIONSHIP = {
  owner: "organization_owner",
  organization_representative: "organization_owner",
  location_manager: "location_manager",
  authorized_staff: "location_staff",
};
const REQUEST_LABELS = {
  claim_existing_directory_profile: "Revendicare profil liber",
  access_request_existing_claimed_profile: "Solicitare acces profil administrat",
  new_patient_facing_location: "Organizatie si locatie noua",
  new_professional_profile: "Profil profesional nou",
  new_b2b_supplier_profile: "Partener B2B nou",
  duplicate_identity_clarification: "Clarificare profil duplicat",
};

function parseJSON(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function requestedRoleForClaim(claim, submitted) {
  return claim.requested_membership_role
    || submitted.requested_membership_role
    || ROLE_BY_RELATIONSHIP[claim.claimant_relationship]
    || ROLE_BY_RELATIONSHIP[submitted.claimant_relationship]
    || "location_staff";
}

export default function DirOpsClaims() {
  const [claims, setClaims] = useState(null);
  const [locations, setLocations] = useState({});
  const [selectedRoles, setSelectedRoles] = useState({});
  const [action, setAction] = useState(null);

  const load = async () => {
    const [rows, locs] = await Promise.all([
      base44.entities.ProviderClaimRequest.list("-created_date", 200),
      base44.entities.ProviderLocation.list(null, 500),
    ]);
    setClaims(rows);
    setLocations(Object.fromEntries(locs.map((location) => [location.id, location])));
    setSelectedRoles((current) => {
      const next = { ...current };
      rows.forEach((claim) => {
        const submitted = parseJSON(claim.submitted_payload);
        next[claim.id] = next[claim.id] || requestedRoleForClaim(claim, submitted);
      });
      return next;
    });
  };

  useEffect(() => { load(); }, []);

  const pendingCount = useMemo(
    () => (claims || []).filter((claim) => ["in_asteptare", "needs_more_info"].includes(claim.status)).length,
    [claims],
  );

  const run = async (note) => {
    const response = await base44.functions.invoke("adminProviderClaimReview", {
      action: action.type,
      claim_id: action.claimId,
      membership_role: action.membershipRole,
      note,
    });
    if (response.data?.error) throw new Error(response.data.error);
    setAction(null);
    await load();
  };

  return (
    <AdminCard className="p-5">
      {!claims && <p className="text-muted-foreground text-sm">Se incarca...</p>}
      {claims && claims.length === 0 && <EmptyState icon={FileCheck2} title="Nicio solicitare." subtitle="Revendicarile si inscrierile furnizorilor vor aparea aici." />}
      {claims && claims.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{claims.length} solicitari</span>
            <span>{pendingCount} necesita decizie</span>
          </div>
          {claims.map((claim) => {
            const location = locations[claim.location_id];
            const submitted = parseJSON(claim.submitted_payload);
            const requestType = claim.request_type || submitted.request_type || (claim.mode === "claim" ? "claim_existing_directory_profile" : "new_patient_facing_location");
            const requestedRole = requestedRoleForClaim(claim, submitted);
            const isDuplicateReview = claim.mode === "new_location_duplicate_review" || requestType === "duplicate_identity_clarification";
            const isProfessional = requestType === "new_professional_profile";
            const isPending = ["in_asteptare", "needs_more_info"].includes(claim.status);
            const statusClass = claim.status === "aprobata"
              ? "bg-green-100 text-green-800"
              : claim.status === "respinsa"
                ? "bg-red-100 text-red-800"
                : claim.status === "needs_more_info"
                  ? "bg-orange-100 text-orange-800"
                  : "bg-yellow-100 text-yellow-800";

            return (
              <div key={claim.id} className="rounded-xl border border-border bg-secondary/35 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-[240px] flex-1">
                    <div className="font-semibold text-sm">{claim.business_name || location?.name || "Fara nume"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {REQUEST_LABELS[requestType] || requestType} · {claim.contact_name} · {claim.email}{claim.phone ? ` · ${claim.phone}` : ""}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {location ? `${location.name}, ${location.city || location.locality_name || ""}` : isDuplicateReview ? "Nicio locatie creata" : "Locatie propusa"}
                    </div>
                    {!isProfessional && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Rol solicitat:</span>
                        <span className="rounded-full border border-border bg-card px-2 py-1 font-semibold">{ROLE_LABELS[requestedRole] || requestedRole}</span>
                        {isPending && !isDuplicateReview && (
                          <select
                            value={selectedRoles[claim.id] || requestedRole}
                            onChange={(event) => setSelectedRoles((current) => ({ ...current, [claim.id]: event.target.value }))}
                            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
                          >
                            {Object.entries(ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>Aproba: {label}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    {isProfessional && <div className="mt-2 text-xs font-semibold">La aprobare se creeaza profil profesional draft, nu membership de organizatie.</div>}
                    {claim.review_notes && <div className="mt-2 text-xs text-muted-foreground">Nota: {claim.review_notes}</div>}
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>{claim.status}</span>
                  {isPending && (
                    <div className="flex gap-2">
                      {!isDuplicateReview && (
                        <button
                          onClick={() => setAction({ claimId: claim.id, type: "approve", membershipRole: isProfessional ? null : (selectedRoles[claim.id] || requestedRole) })}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          Aproba
                        </button>
                      )}
                      <button onClick={() => setAction({ claimId: claim.id, type: "reject", membershipRole: null })} className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-destructive">Respinge</button>
                    </div>
                  )}
                </div>
                <AdminClaimIdentityContext claim={claim} />
                {isDuplicateReview && isPending && (
                  <p className="mt-2 text-xs text-muted-foreground">Clarifica identitatea. Daca profilul este distinct, creeaza-l numai prin fluxul canonic dupa verificare, apoi inchide aceasta solicitare cu nota.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {action && (
        <DirOpsActionNote
          title={action.type === "approve" ? "Aprobare solicitare si acordare acces" : "Respingere solicitare — nota obligatorie"}
          noteOptional={action.type === "approve"}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
    </AdminCard>
  );
}
