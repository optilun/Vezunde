import React from "react";
import { Link } from "react-router-dom";
import ContinueButton from "@/components/intake/ContinueButton";
import { CLAIMANT_RELATIONSHIPS, MEMBERSHIP_ROLE_LABELS } from "@/components/provider/ContactIdentityFields";

const VERIFICATION_LABELS = {
  manual_review: "Verificare manuala VIASEE",
  official_email: "Email oficial al organizatiei",
  public_phone: "Telefonul public al locatiei",
  existing_owner_approval: "Aprobarea unui owner existent",
};

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export default function ClaimReviewStep({ locationCard, contact, requestedRole, error, submitting, onSubmit }) {
  return (
    <div className="text-left">
      <div className="mb-3">{locationCard}</div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acces solicitat</div>
        <Row label="Relatie" value={CLAIMANT_RELATIONSHIPS[contact.claimant_relationship]} />
        <Row label="Rol solicitat" value={MEMBERSHIP_ROLE_LABELS[requestedRole] || requestedRole} />
      </div>
      <div className="mt-3 rounded-xl border border-border bg-card p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date private de verificare</div>
        <Row label="Nume" value={contact.contact_name} />
        <Row label="Email" value={contact.email} />
        <Row label="Telefon" value={contact.phone} />
        <Row label="Metoda" value={VERIFICATION_LABELS[contact.verification_method] || VERIFICATION_LABELS.manual_review} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Profilul si accesul nu sunt modificate automat. Cererea este analizata, iar rolul final poate fi ajustat in functie de verificare.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Prin trimitere confirmi ca ai citit <Link to="/confidentialitate" className="underline underline-offset-2">Politica de confidentialitate</Link> si <Link to="/termeni" className="underline underline-offset-2">Termenii</Link>.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} loading={submitting}>Trimite spre verificare</ContinueButton>
    </div>
  );
}
