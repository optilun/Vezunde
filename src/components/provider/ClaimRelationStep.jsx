import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import { CLAIMANT_RELATIONSHIPS } from "@/components/provider/ContactIdentityFields";

export default function ClaimRelationStep({ locationCard, contact, onChange, onContinue, loading = false }) {
  const valid = contact.claimant_relationship && contact.representation_confirmed;
  return (
    <div className="text-left">
      <div className="mb-5">{locationCard}</div>
      <div className="space-y-2.5">
        {Object.entries(CLAIMANT_RELATIONSHIPS).map(([key, label]) => (
          <ChoiceCard
            key={key}
            label={label}
            selected={contact.claimant_relationship === key}
            onClick={() => onChange({ ...contact, claimant_relationship: key })}
          />
        ))}
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 w-4 h-4"
          checked={contact.representation_confirmed}
          onChange={(e) => onChange({ ...contact, representation_confirmed: e.target.checked })}
        />
        <span>Confirm ca sunt autorizat sa solicit acces pentru aceasta locatie si ca informatiile transmise sunt corecte.</span>
      </label>
      <ContinueButton onClick={onContinue} disabled={!valid} loading={loading}>
        Continua
      </ContinueButton>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        In pasul urmator te autentifici sau iti creezi contul VIASEE, apoi revii automat aici.
      </p>
    </div>
  );
}
