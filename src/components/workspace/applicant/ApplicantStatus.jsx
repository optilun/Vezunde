import React from "react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { CLAIMANT_RELATIONSHIPS, MEMBERSHIP_ROLE_LABELS, requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

export default function ApplicantStatus({ claim }) {
  if (!claim) return null;
  const requestedRole = requestedRoleForRelationship(claim.claimant_relationship);
  const isProfessional = claim.claim_subject_type === "independent_professional";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Status solicitare</h1>
        <p className="mt-1 text-xs text-muted-foreground">Aici apare decizia si orice completare solicitata de echipa VIASEE.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
        <div><span className="text-muted-foreground">Status:</span> {CLAIM_STATUS_LABELS[claim.status] || claim.status}</div>
        {claim.claimant_relationship && <div><span className="text-muted-foreground">Relatie declarata:</span> {CLAIMANT_RELATIONSHIPS[claim.claimant_relationship] || claim.claimant_relationship}</div>}
        {!isProfessional && <div><span className="text-muted-foreground">Acces solicitat:</span> {MEMBERSHIP_ROLE_LABELS[requestedRole]}</div>}
        <div><span className="text-muted-foreground">Contact:</span> {claim.contact_name}</div>
        <div><span className="text-muted-foreground">Email:</span> {claim.email}</div>
        {claim.latest_admin_note && <div className="text-amber-700"><span className="text-muted-foreground">Nota VIASEE:</span> {claim.latest_admin_note}</div>}
      </div>
    </div>
  );
}
