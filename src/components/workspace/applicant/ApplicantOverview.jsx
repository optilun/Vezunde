import React from "react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { MEMBERSHIP_ROLE_LABELS, requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

export default function ApplicantOverview({ workspace, onNavigate }) {
  const claim = workspace.claim;
  const drafts = workspace.preparation_drafts || [];
  const allowedSections = new Set(workspace.allowed_sections || []);
  const isProfessional = claim?.claim_subject_type === "independent_professional";
  const isB2B = claim?.claim_subject_type === "b2b_supplier";
  const isDuplicateReview = claim?.mode === "new_location_duplicate_review";
  const canPrepare = allowedSections.size > 0 && !isDuplicateReview;
  const title = isDuplicateReview
    ? "Solicitarea necesita clarificare"
    : isProfessional
      ? "Profil profesional in verificare"
      : isB2B
        ? "Pregateste profilul de partener"
        : "Pregateste profilul organizatiei";
  const requestedRole = requestedRoleForRelationship(claim?.claimant_relationship);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {canPrepare
            ? "Datele pregatite raman private pana la aprobarea solicitarii."
            : "Urmareste statusul solicitarii. Configurarea profilului devine disponibila dupa clarificare sau aprobare."}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold text-sm">Status solicitare</div>
        <div className="text-xs text-muted-foreground mt-1">{CLAIM_STATUS_LABELS[claim?.status] || claim?.status}</div>
        {!isProfessional && claim?.claimant_relationship && (
          <div className="mt-2 text-xs"><span className="text-muted-foreground">Acces solicitat:</span> <span className="font-semibold">{MEMBERSHIP_ROLE_LABELS[requestedRole]}</span></div>
        )}
        {claim?.latest_admin_note && <div className="text-xs text-amber-700 mt-2">{claim.latest_admin_note}</div>}
      </div>
      {canPrepare && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-2">Drafturi private ({drafts.length})</div>
          {drafts.length === 0 && <p className="text-xs text-muted-foreground">Nu ai inca informatii pregatite.</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {allowedSections.has("public_profile") && <button onClick={() => onNavigate("profile")} className="text-xs font-semibold underline underline-offset-4">Profil public</button>}
            {allowedSections.has("operating_hours") && <button onClick={() => onNavigate("hours")} className="text-xs font-semibold underline underline-offset-4">Program</button>}
            {allowedSections.has("services") && <button onClick={() => onNavigate("services")} className="text-xs font-semibold underline underline-offset-4">Servicii</button>}
          </div>
        </div>
      )}
    </div>
  );
}
