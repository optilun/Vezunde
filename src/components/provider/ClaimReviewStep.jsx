import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import {
  CLAIMANT_RELATIONSHIPS,
  REQUESTED_ROLE_LABELS,
  requestedRoleForRelationship,
} from "@/components/provider/ContactIdentityFields";

export default function ClaimReviewStep({ locationCard, contact, error, submitting, onSubmit }) {
  const requestedRole = requestedRoleForRelationship(contact.claimant_relationship);
  return (
    <div className="text-left">
      <div className="mb-3">{locationCard}</div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nume</span><span className="font-medium text-right">{contact.contact_name}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Relatie</span><span className="font-medium text-right">{CLAIMANT_RELATIONSHIPS[contact.claimant_relationship] || "—"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Acces solicitat</span><span className="font-medium text-right">{REQUESTED_ROLE_LABELS[requestedRole]}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email privat</span><span className="font-medium text-right break-all">{contact.email}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Telefon privat</span><span className="font-medium text-right">{contact.phone || "—"}</span></div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Profilul nu este modificat automat. VIASEE verifica relatia declarata si poate ajusta accesul acordat inainte de aprobare.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} loading={submitting}>Trimite spre verificare</ContinueButton>
    </div>
  );
}
