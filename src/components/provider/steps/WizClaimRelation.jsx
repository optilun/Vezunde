import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import { CLAIMANT_RELATIONSHIPS, REQUESTED_ROLE_LABELS, requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

const RELATION_HINTS = {
  owner: "Soliciti administrarea organizatiei si, dupa verificare, a locatiilor sale.",
  organization_representative: "Soliciti administrarea in numele organizatiei, pe baza autorizarii declarate.",
  location_manager: "Soliciti administrarea locatiei selectate, fara control asupra intregii organizatii.",
  authorized_staff: "Soliciti acces operational limitat pentru actualizarea locatiei.",
};

export default function WizClaimRelation({ data, update, next, loading = false }) {
  const contact = data.contact;
  const setContact = (patch) => update({ contact: { ...contact, ...patch } });
  const requestedRole = requestedRoleForRelationship(contact.claimant_relationship);
  const valid = Boolean(contact.claimant_relationship && contact.representation_confirmed);

  return (
    <div className="space-y-4 text-left">
      <div className="space-y-2.5">
        {Object.entries(CLAIMANT_RELATIONSHIPS).map(([key, label]) => (
          <ChoiceCard
            key={key}
            label={label}
            hint={RELATION_HINTS[key]}
            selected={contact.claimant_relationship === key}
            onClick={() => setContact({ claimant_relationship: key })}
          />
        ))}
      </div>

      {contact.claimant_relationship && (
        <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          Acces solicitat: <span className="font-semibold text-foreground">{REQUESTED_ROLE_LABELS[requestedRole]}</span>. Rolul final este confirmat de VIASEE la verificare.
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={contact.representation_confirmed}
          onChange={(event) => setContact({ representation_confirmed: event.target.checked })}
        />
        <span>Confirm ca sunt autorizat sa solicit acest acces si ca informatiile transmise sunt corecte.</span>
      </label>

      <ContinueButton onClick={next} disabled={!valid} loading={loading}>Continua</ContinueButton>
      <p className="text-center text-xs text-muted-foreground">Daca nu esti autentificat, iti vei crea contul VIASEE si vei reveni automat la pasul urmator.</p>
    </div>
  );
}
