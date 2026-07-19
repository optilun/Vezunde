import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import {
  CLAIMANT_RELATIONSHIPS,
  REQUESTED_ROLE_LABELS,
  requestedLocationRoleForRelationship,
} from "@/components/provider/ContactIdentityFields";

const RELATION_HINTS = {
  owner: "In pasul urmator poti solicita o locatie, mai multe locatii sau intreaga organizatie existenta.",
  organization_representative: "Poti solicita administrarea organizatiei numai pentru locatiile pe care le confirmi explicit.",
  location_manager: "Poti solicita una sau mai multe locatii, fara rol de owner al organizatiei.",
  authorized_staff: "Poti solicita acces operational limitat pentru una sau mai multe locatii.",
};

export default function ClaimRelationStep({ locationCard, contact, onChange, onContinue, loading = false }) {
  const valid = contact.claimant_relationship && contact.representation_confirmed;
  const requestedRole = requestedLocationRoleForRelationship(contact.claimant_relationship);

  return (
    <div className="text-left">
      <div className="mb-5">{locationCard}</div>
      <div className="space-y-2.5">
        {Object.entries(CLAIMANT_RELATIONSHIPS).map(([key, label]) => (
          <ChoiceCard
            key={key}
            label={label}
            hint={RELATION_HINTS[key]}
            selected={contact.claimant_relationship === key}
            onClick={() => onChange({ ...contact, claimant_relationship: key })}
          />
        ))}
      </div>

      {contact.claimant_relationship && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Pentru o singura locatie, accesul solicitat este <span className="font-semibold text-foreground">{REQUESTED_ROLE_LABELS[requestedRole]}</span>. Daca reprezinti organizatia, vei putea alege scope-ul complet in pasul urmator. Rolul final este confirmat de VIASEE.
        </div>
      )}

      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={contact.representation_confirmed}
          onChange={(event) => onChange({ ...contact, representation_confirmed: event.target.checked })}
        />
        <span>Confirm ca sunt autorizat sa solicit acces si ca informatiile transmise sunt corecte.</span>
      </label>
      <ContinueButton onClick={onContinue} disabled={!valid} loading={loading}>
        Continua
      </ContinueButton>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        In pasul urmator te autentifici sau iti creezi contul VIASEE, apoi confirmi locatiile solicitate.
      </p>
    </div>
  );
}
