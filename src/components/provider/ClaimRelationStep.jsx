import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import { CLAIMANT_RELATIONSHIPS, MEMBERSHIP_ROLE_LABELS } from "@/components/provider/ContactIdentityFields";

export default function ClaimRelationStep({ locationCard, contact, requestedRole, onChange, onContinue }) {
  const valid = contact.claimant_relationship && contact.representation_confirmed;
  return (
    <div className="text-left">
      <div className="mb-5">{locationCard}</div>
      <p className="mb-3 text-sm text-muted-foreground">
        Relatia declarata stabileste tipul de acces solicitat. VIASEE poate aproba un rol diferit dupa verificare.
      </p>
      <div className="space-y-2.5">
        {Object.entries(CLAIMANT_RELATIONSHIPS).map(([key, label]) => (
          <ChoiceCard key={key} label={label} selected={contact.claimant_relationship === key} onClick={() => onChange({ ...contact, claimant_relationship: key })} />
        ))}
      </div>
      {contact.claimant_relationship && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/35 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Acces solicitat:</span>{" "}
          <span className="font-semibold">{MEMBERSHIP_ROLE_LABELS[requestedRole] || requestedRole}</span>
        </div>
      )}
      <label className="mt-4 flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
        <input type="checkbox" className="mt-0.5 w-4 h-4" checked={contact.representation_confirmed} onChange={(e) => onChange({ ...contact, representation_confirmed: e.target.checked })} />
        <span>Confirm ca reprezint aceasta locatie sau organizatie si ca sunt autorizat sa solicit accesul indicat.</span>
      </label>
      <ContinueButton onClick={onContinue} disabled={!valid}>Continua cu datele de verificare</ContinueButton>
    </div>
  );
}
