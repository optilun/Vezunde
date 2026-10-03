import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import { CLAIMANT_RELATIONSHIPS, REQUESTED_ROLE_LABELS, requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

// 2026-10-02. Pasul apare doar la o locatie NOUA, unde cererea creeaza si organizatia. Backendul
// (submitProviderClaim, ROLE_BY_RELATIONSHIP) acorda owner organizatiei pentru proprietar si
// reprezentant, deci textul si rolul afisat urmeaza aceeasi regula. Inainte se folosea maparea
// pentru revendicarea unei locatii existente: aici scria "Manager locatie", iar la revizuire si
// la aprobare "Owner organizatie" (test E2E 2026-10-02).
const RELATION_HINTS = {
  owner: "Creezi organizația și prima ei locație. După verificare devii owner al organizației.",
  organization_representative: "Reprezinți organizația cu acordul ei. După verificare primești rolul de owner al organizației.",
  location_manager: "Soliciți administrarea acestei locații, fără control asupra organizației.",
  authorized_staff: "Soliciți acces operațional limitat pentru actualizarea locației.",
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
        <span>Confirm că sunt autorizat să solicit acest acces și că informațiile transmise sunt corecte.</span>
      </label>

      <ContinueButton onClick={next} disabled={!valid} loading={loading}>Continuă</ContinueButton>
      <p className="text-center text-xs text-muted-foreground">Urmează datele private de verificare, apoi revizuirea solicitării.</p>
    </div>
  );
}
