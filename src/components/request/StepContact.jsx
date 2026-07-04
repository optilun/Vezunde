import React from "react";
import { Loader2, Lock } from "lucide-react";

const FIELD = "mt-1.5 w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors";

export default function StepContact({ data, update, onSubmit, onBack, submitting, error }) {
  const valid = data.name.trim() && /\S+@\S+\.\S+/.test(data.email);
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold tracking-tight">Datele tale de contact</h2>
      <p className="mt-2 text-sm text-muted-foreground">Folosim datele doar ca sa iti pastram cererea. Nu sunt transmise automat furnizorilor.</p>
      <div className="mt-6 space-y-4 max-w-md">
        <label className="block text-sm font-medium">
          Nume
          <input value={data.name} onChange={(e) => update({ name: e.target.value })} className={FIELD} placeholder="Numele tau" />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input type="email" value={data.email} onChange={(e) => update({ email: e.target.value })} className={FIELD} placeholder="email@exemplu.ro" />
        </label>
        <label className="block text-sm font-medium">
          Telefon (optional)
          <input value={data.phone} onChange={(e) => update({ phone: e.target.value })} className={FIELD} placeholder="07xx xxx xxx" />
          <span className="mt-1.5 flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            <Lock className="w-3 h-3" /> Numarul tau nu se transmite furnizorilor.
          </span>
        </label>
      </div>
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="mt-8 flex gap-3">
        <button onClick={onBack} disabled={submitting} className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary/40 transition-colors">Inapoi</button>
        <button
          onClick={onSubmit}
          disabled={!valid || submitting}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-8 py-3 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Trimite cererea
        </button>
      </div>
    </div>
  );
}