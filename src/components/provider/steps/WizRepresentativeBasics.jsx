import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { CLAIMANT_RELATIONSHIPS, MEMBERSHIP_ROLE_LABELS, requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

export default function WizRepresentativeBasics({ data, update, next }) {
  const contact = data.contact;
  const isProfessional = data.claimSubjectType === "independent_professional";
  const setContact = (key, value) => update({ contact: { ...contact, [key]: value } });
  const requestedRole = requestedRoleForRelationship(contact.claimant_relationship);
  const valid = contact.contact_name.trim() && contact.email.trim() && contact.claimant_relationship && contact.representation_confirmed;

  return (
    <div className="space-y-4 text-left">
      <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Aceste date sunt private si sunt folosite numai pentru verificarea solicitarii. Nu apar pe profilul public.
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Nume complet *</label>
        <input className={inputCls} value={contact.contact_name} onChange={(e) => setContact("contact_name", e.target.value)} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Email pentru comunicarea solicitarii *</label>
        <input className={inputCls} type="email" value={contact.email} onChange={(e) => setContact("email", e.target.value)} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Telefon</label>
        <input className={inputCls} value={contact.phone} onChange={(e) => setContact("phone", e.target.value)} placeholder="Optional" />
      </div>
      {!isProfessional && (
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Relatia cu firma *</label>
          <select className={inputCls} value={contact.claimant_relationship} onChange={(e) => setContact("claimant_relationship", e.target.value)}>
            <option value="">Selecteaza relatia</option>
            {Object.entries(CLAIMANT_RELATIONSHIPS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      )}
      {contact.claimant_relationship && (
        <div className="rounded-xl border border-border bg-secondary/35 px-4 py-3 text-sm">
          <span className="text-muted-foreground">Acces solicitat:</span> <span className="font-semibold">{MEMBERSHIP_ROLE_LABELS[requestedRole]}</span>
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Metoda initiala de verificare</label>
        <select className={inputCls} value={contact.verification_method || "manual_review"} onChange={(e) => setContact("verification_method", e.target.value)}>
          <option value="manual_review">Verificare manuala VIASEE</option>
          <option value="official_email">Email oficial</option>
          <option value="public_phone">Telefon public</option>
          <option value="existing_owner_approval">Aprobarea unui owner existent</option>
        </select>
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={contact.representation_confirmed} onChange={(e) => setContact("representation_confirmed", e.target.checked)} />
        <span>{isProfessional ? "Confirm ca datele profesionale transmise imi apartin si sunt corecte." : "Confirm ca reprezint firma si ca sunt autorizat sa solicit accesul indicat."}</span>
      </label>
      <ContinueButton onClick={next} disabled={!valid}>Continua spre revizuire</ContinueButton>
    </div>
  );
}
