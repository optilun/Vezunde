import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { CLAIMANT_RELATIONSHIPS } from "@/components/provider/ContactIdentityFields";

export default function ClaimReviewStep({ locationCard, contact, error, submitting, onSubmit }) {
  return (
    <div className="text-left">
      <div className="mb-3">{locationCard}</div>
      <div className="rounded-xl border border-border bg-card p-4 space-y-1.5 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Nume</span><span className="font-medium">{contact.contact_name}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Relatie</span><span className="font-medium">{CLAIMANT_RELATIONSHIPS[contact.claimant_relationship] || "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{contact.email}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Telefon</span><span className="font-medium">{contact.phone || "—"}</span></div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Profilul nu va fi modificat pana cand cererea nu este verificata.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} loading={submitting}>
        Trimite spre verificare
      </ContinueButton>
    </div>
  );
}