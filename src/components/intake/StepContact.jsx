import React, { useState } from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const FIELD = "w-full bg-card border border-border rounded-xl px-4 py-3 text-base outline-none focus:border-foreground/40 transition-colors";
const PREFS = ["Email", "Telefon", "Oricare"];

export default function StepContact({ onSubmit, submitting, error }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [preference, setPreference] = useState("");
  const [consent, setConsent] = useState(false);

  const valid = name.trim() && contact.trim() && preference && consent;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    const isEmail = contact.includes("@");
    onSubmit({
      contact_name: name.trim(),
      contact_email: isEmail ? contact.trim() : "",
      contact_phone: isEmail ? "" : contact.trim(),
      contact_preference: preference,
      consent: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nume" className={FIELD} />
      <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email sau telefon" className={FIELD} />
      <div>
        <div className="text-sm font-semibold mb-2">Preferinta de contact</div>
        <div className="flex gap-2">
          {PREFS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreference(p)}
              className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                preference === p ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-foreground/40"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-start gap-3 cursor-pointer text-sm text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-black" />
        Sunt de acord cu prelucrarea datelor mele pentru gestionarea solicitarii.
      </label>
      <p className="text-xs text-muted-foreground">
        Datele tale de contact nu sunt transmise automat furnizorilor.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ContinueButton type="submit" disabled={!valid} loading={submitting}>Trimite solicitarea</ContinueButton>
    </form>
  );
}