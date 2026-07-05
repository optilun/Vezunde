import React from "react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

export default function ApplicantStatus({ claim }) {
  if (!claim) return null;
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Status solicitare</h1>
      <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
        <div><span className="text-muted-foreground">Status:</span> {CLAIM_STATUS_LABELS[claim.status] || claim.status}</div>
        <div><span className="text-muted-foreground">Contact:</span> {claim.contact_name}</div>
        <div><span className="text-muted-foreground">Email:</span> {claim.email}</div>
        {claim.latest_admin_note && <div className="text-amber-700"><span className="text-muted-foreground">Nota admin:</span> {claim.latest_admin_note}</div>}
      </div>
    </div>
  );
}