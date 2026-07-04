import React, { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const FIELD = "mt-1.5 w-full bg-card border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-colors";

export default function ClaimProfile() {
  const [form, setForm] = useState({ business_name: "", contact_name: "", role: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const valid = form.business_name.trim() && form.contact_name.trim() && /\S+@\S+\.\S+/.test(form.email);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await base44.entities.ClaimRequest.create({ ...form, status: "in_asteptare" });
      setDone(true);
    } catch {
      setError("Nu am putut trimite cererea. Incearca din nou.");
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-5 pt-20 pb-8 text-center">
        <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Cerere primita</h1>
        <p className="mt-3 text-sm text-muted-foreground">Multumim! Te vom contacta pe email pentru pasii urmatori de verificare a profilului.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-5 pt-12 pb-8">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Revendica un profil</h1>
      <p className="mt-2 text-sm text-muted-foreground">Reprezinti o optica, o clinica sau un cabinet? Completeaza formularul si te contactam pentru verificare.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium">
          Numele afacerii
          <input value={form.business_name} onChange={set("business_name")} className={FIELD} placeholder="Ex: Optica Vederea Clara" />
        </label>
        <label className="block text-sm font-medium">
          Numele tau
          <input value={form.contact_name} onChange={set("contact_name")} className={FIELD} placeholder="Nume si prenume" />
        </label>
        <label className="block text-sm font-medium">
          Rolul tau
          <input value={form.role} onChange={set("role")} className={FIELD} placeholder="Ex: Administrator, Optometrist" />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input type="email" value={form.email} onChange={set("email")} className={FIELD} placeholder="email@exemplu.ro" />
        </label>
        <label className="block text-sm font-medium">
          Telefon
          <input value={form.phone} onChange={set("phone")} className={FIELD} placeholder="07xx xxx xxx" />
        </label>
        <label className="block text-sm font-medium">
          Mesaj (optional)
          <textarea value={form.message} onChange={set("message")} rows={3} className={`${FIELD} resize-none`} placeholder="Detalii despre locatie sau servicii" />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={!valid || submitting}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-8 py-3 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Trimite cererea
        </button>
      </form>
    </div>
  );
}