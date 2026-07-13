import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

export default function WizClaimContact({ data, update, next }) {
  const contact = data.contact;
  const setContact = (key, value) => update({ contact: { ...contact, [key]: value } });
  const valid = Boolean(contact.contact_name.trim() && contact.email.trim());

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Aceste date sunt private. Sunt folosite numai pentru verificarea solicitarii si comunicarea privind accesul. Nu apar in profilul public.
      </div>
      <input
        className={inputCls}
        placeholder="Numele complet *"
        value={contact.contact_name}
        onChange={(event) => setContact("contact_name", event.target.value)}
      />
      <input
        className={inputCls}
        type="email"
        placeholder="Email pentru verificare *"
        value={contact.email}
        onChange={(event) => setContact("email", event.target.value)}
      />
      <input
        className={inputCls}
        placeholder="Telefon pentru verificare (optional)"
        value={contact.phone}
        onChange={(event) => setContact("phone", event.target.value)}
      />
      <ContinueButton onClick={next} disabled={!valid}>Continua spre revizuire</ContinueButton>
    </div>
  );
}
