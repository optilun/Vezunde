import React, { useState } from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-foreground/40 transition-colors";

export default function ClaimStepSubmit({ onSubmit, submitting, error }) {
  const [contact, setContact] = useState({ contact_name: "", role: "", email: "", phone: "" });
  const [confirmed, setConfirmed] = useState(false);
  const set = (k) => (e) => setContact((c) => ({ ...c, [k]: e.target.value }));

  const valid = contact.contact_name.trim() && contact.email.trim() && confirmed;

  return (
    <div className="space-y-4">
      <input value={contact.contact_name} onChange={set("contact_name")} placeholder="Numele tau" className={FIELD} />
      <input value={contact.role} onChange={set("role")} placeholder="Rolul tau (ex: administrator, optician)" className={FIELD} />
      <input value={contact.email} onChange={set("email")} placeholder="Email de serviciu" className={FIELD} />
      <input value={contact.phone} onChange={set("phone")} placeholder="Telefon" className={FIELD} />
      <label className="flex items-start gap-3 cursor-pointer text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-black"
        />
        Confirm ca reprezint aceasta locatie si ca informatiile transmise sunt corecte.
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={() => onSubmit(contact)} disabled={!valid} loading={submitting}>
        Trimite pentru verificare
      </ContinueButton>
    </div>
  );
}