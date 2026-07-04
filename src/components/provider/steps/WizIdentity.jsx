import React from "react";
import ContactIdentityFields from "@/components/provider/ContactIdentityFields";
import ContinueButton from "@/components/intake/ContinueButton";

export default function WizIdentity({ data, update, onSubmit, submitting, error }) {
  const c = data.contact;
  const valid = c.contact_name.trim() && c.email.trim() && c.representation_confirmed;
  return (
    <div className="text-left">
      <ContactIdentityFields value={c} onChange={(v) => update({ contact: v })} />
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} disabled={!valid} loading={submitting}>
        Trimite spre verificare
      </ContinueButton>
    </div>
  );
}