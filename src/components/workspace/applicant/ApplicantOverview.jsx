import React from "react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

export default function ApplicantOverview({ workspace, onNavigate }) {
  const claim = workspace.claim;
  const drafts = workspace.preparation_drafts || [];
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Pregateste profilul locatiei</h1>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold text-sm">Status solicitare</div>
        <div className="text-xs text-muted-foreground mt-1">{CLAIM_STATUS_LABELS[claim?.status] || claim?.status}</div>
        {claim?.latest_admin_note && <div className="text-xs text-amber-700 mt-2">{claim.latest_admin_note}</div>}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold text-sm mb-2">Drafturi private ({drafts.length})</div>
        {drafts.length === 0 && <p className="text-xs text-muted-foreground">Nu ai inca informatii pregatite.</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          <button onClick={() => onNavigate("profile")} className="text-xs font-semibold underline underline-offset-4">Profil public</button>
          <button onClick={() => onNavigate("hours")} className="text-xs font-semibold underline underline-offset-4">Program</button>
          <button onClick={() => onNavigate("services")} className="text-xs font-semibold underline underline-offset-4">Servicii</button>
        </div>
      </div>
    </div>
  );
}