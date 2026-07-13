import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50 transition-colors";

export default function ClaimContactStep({ locationCard, contact, onChange, onContinue }) {
  const set = (k, v) => onChange({ ...contact, [k]: v });
  const valid = contact.contact_name.trim() && contact.email.trim();
  return (
    <div className="text-left">
      <div className="mb-5">{locationCard}</div>
      <div className="mb-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Datele de mai jos sunt private. Le folosim numai pentru verificarea solicitarii si comunicarea privind accesul. Nu apar pe profilul public al locatiei.
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nume complet *</label>
          <input className={inputCls} placeholder="Numele tau" value={contact.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email pentru comunicarea solicitarii *</label>
          <input className={inputCls} type="email" placeholder="email@exemplu.ro" value={contact.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Telefon</label>
          <input className={inputCls} placeholder="Optional" value={contact.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Metoda initiala de verificare</label>
          <select className={inputCls} value={contact.verification_method || "manual_review"} onChange={(e) => set("verification_method", e.target.value)}>
            <option value="manual_review">Verificare manuala VIASEE</option>
            <option value="official_email">Email oficial al organizatiei</option>
            <option value="public_phone">Telefonul public al locatiei</option>
            <option value="existing_owner_approval">Aprobarea unui owner existent</option>
          </select>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Metoda poate fi schimbata de echipa VIASEE daca profilul necesita o verificare diferita.</p>
        </div>
      </div>
      <ContinueButton onClick={onContinue} disabled={!valid}>Continua spre revizuire</ContinueButton>
    </div>
  );
}
