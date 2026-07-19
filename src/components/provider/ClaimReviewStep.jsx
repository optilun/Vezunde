import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import {
  CLAIMANT_RELATIONSHIPS,
  REQUESTED_ROLE_LABELS,
  requestedLocationRoleForRelationship,
} from "@/components/provider/ContactIdentityFields";

export default function ClaimReviewStep({ locationCard, contact, error, submitting, onSubmit }) {
  const requestedRole = requestedLocationRoleForRelationship(contact.claimant_relationship);
  return (
    <div className="text-left">
      <div className="mb-3">{locationCard}</div>
      <div className="space-y-1.5 rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Nume</span><span className="text-right font-medium">{contact.contact_name}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Relatie</span><span className="text-right font-medium">{CLAIMANT_RELATIONSHIPS[contact.claimant_relationship] || "—"}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Acces solicitat pentru locatie</span><span className="text-right font-medium">{REQUESTED_ROLE_LABELS[requestedRole]}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Email privat</span><span className="break-all text-right font-medium">{contact.email}</span></div>
        <div className="flex justify-between gap-4"><span className="text-muted-foreground">Telefon privat</span><span className="text-right font-medium">{contact.phone || "—"}</span></div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Solicitarea este limitata la locatia selectata. Administrarea intregii organizatii necesita o verificare separata. Profilul nu este modificat automat, iar VIASEE poate ajusta rolul acordat inainte de aprobare.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} loading={submitting}>Trimite spre verificare</ContinueButton>
    </div>
  );
}
