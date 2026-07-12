import React from "react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { MEMBERSHIP_ROLE_LABELS, requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

export default function ApplicantOverview({ workspace, onNavigate }) {
  const claim = workspace.claim;
  const drafts = workspace.preparation_drafts || [];
  const isProfessional = claim?.claim_subject_type === "independent_professional";
  const isB2B = claim?.claim_subject_type === "b2b_supplier";
  const title = isProfessional ? "Pregateste profilul profesional" : isB2B ? "Pregateste profilul de partener" : "Pregateste profilul organizatiei";
  const requestedRole = requestedRoleForRelationship(claim?.claimant_relationship);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Datele pregatite raman private pana la aprobarea solicitarii.</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold text-sm">Status solicitare</div>
        <div className="text-xs text-muted-foreground mt-1">{CLAIM_STATUS_LABELS[claim?.status] || claim?.status}</div>
        {!isProfessional && claim?.claimant_relationship && (
          <div className="mt-2 text-xs"><span className="text-muted-foreground">Acces solicitat:</span> <span className="font-semibold">{MEMBERSHIP_ROLE_LABELS[requestedRole]}</span></div>
        )}
        {claim?.latest_admin_note && <div className="text-xs text-amber-700 mt-2">{claim.latest_admin_note}</div>}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold text-sm mb-2">Drafturi private ({drafts.length})</div>
        {drafts.length === 0 && <p className="text-xs text-muted-foreground">Nu ai inca informatii pregatite.</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={() => onNavigate("profile")} className="text-xs font-semibold underline underline-offset-4">{isProfessional ? "Profil profesional" : "Profil public"}</button>
          {!isProfessional && <button onClick={() => onNavigate("hours")} className="text-xs font-semibold underline underline-offset-4">Program</button>}
          {!isProfessional && <button onClick={() => onNavigate("services")} className="text-xs font-semibold underline underline-offset-4">Servicii</button>}
        </div>
      </div>
    </div>
  );
}
