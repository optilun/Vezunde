import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50 transition-colors";

export default function ClaimContactStep({ locationCard, contact, onChange, onContinue }) {
  const set = (k, v) => onChange({ ...contact, [k]: v });
  const valid = contact.contact_name.trim() && contact.email.trim();
  return (
    <div className="text-left">
      <div className="mb-5">{locationCard}</div>
      <p className="mb-4 text-sm text-muted-foreground">
        Vom folosi aceste date doar pentru verificarea solicitarii tale.
      </p>
      <div className="space-y-3">
        <input className={inputCls} placeholder="Nume complet *" value={contact.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        <input className={inputCls} type="email" placeholder="Email *" value={contact.email} onChange={(e) => set("email", e.target.value)} />
        <input className={inputCls} placeholder="Telefon (optional)" value={contact.phone} onChange={(e) => set("phone", e.target.value)} />
      </div>
      <ContinueButton onClick={onContinue} disabled={!valid}>
        Continua spre revizuire
      </ContinueButton>
    </div>
  );
}