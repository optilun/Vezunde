import React from "react";
import ContactIdentityFields from "@/components/provider/ContactIdentityFields";
import ContinueButton from "@/components/intake/ContinueButton";

export default function WizIdentity({ data, update, next }) {
  const c = data.contact;
  const valid = c.contact_name.trim() && c.email.trim() && c.representation_confirmed;
  return (
    <div className="text-left">
      <p className="text-sm text-muted-foreground mb-4">
        Aceste date raman private si sunt folosite doar pentru verificarea cererii tale.
      </p>
      <ContactIdentityFields value={c} onChange={(v) => update({ contact: v })} />
      <ContinueButton onClick={next} disabled={!valid}>
        Continua spre revizuire
      </ContinueButton>
    </div>
  );
}