import React, { useState } from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROVIDER_TYPES, SERVICES } from "@/lib/vezunde";

const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-foreground/40 transition-colors";

export default function OnbSubmit({ data, onSubmit, submitting, error }) {
  const [contact, setContact] = useState({ contact_name: "", role: "", email: "", phone: "" });
  const set = (k) => (e) => setContact((c) => ({ ...c, [k]: e.target.value }));
  const valid = contact.contact_name.trim() && contact.email.trim();

  return (
    <div>
      <div className="bg-card border border-border rounded-2xl p-5 text-sm space-y-1.5">
        <div><span className="text-muted-foreground">Locatie:</span> <span className="font-medium">{data.name}</span></div>
        <div><span className="text-muted-foreground">Tip:</span> {PROVIDER_TYPES[data.provider_type]}</div>
        <div><span className="text-muted-foreground">Oras:</span> {data.city}</div>
        <div><span className="text-muted-foreground">Servicii:</span> {data.services.map((s) => SERVICES[s]).join(", ")}</div>
        <div><span className="text-muted-foreground">Puncte forte:</span> {data.strengths.map((s) => SERVICES[s]).join(", ")}</div>
        <div><span className="text-muted-foreground">Echipa:</span> {data.team.map((m) => m.full_name).join(", ")}</div>
      </div>
      <div className="mt-5 space-y-3">
        <input value={contact.contact_name} onChange={set("contact_name")} placeholder="Numele tau" className={FIELD} />
        <input value={contact.role} onChange={set("role")} placeholder="Rolul tau (ex: administrator, optician)" className={FIELD} />
        <input value={contact.email} onChange={set("email")} placeholder="Email de contact" className={FIELD} />
        <input value={contact.phone} onChange={set("phone")} placeholder="Telefon (optional)" className={FIELD} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Profilul devine vizibil ca verificat doar dupa validarea manuala de catre echipa Vezunde.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={() => onSubmit(contact)} disabled={!valid} loading={submitting}>
        Trimite pentru verificare
      </ContinueButton>
    </div>
  );
}