import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { CLAIMANT_RELATIONSHIPS, MEMBERSHIP_ROLE_LABELS, requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

const PROFESSION_LABELS = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};
const VERIFICATION_LABELS = {
  manual_review: "Verificare manuala VIASEE",
  official_email: "Email oficial",
  public_phone: "Telefon public",
  existing_owner_approval: "Aprobarea unui owner existent",
};

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right max-w-[62%]">{value || "—"}</span>
  </div>
);

export default function WizReviewShort({ data, onSubmit, submitting, error }) {
  const { claimSubjectType, organization: org, professional: prof, location: loc, contact } = data;
  const isProfessional = claimSubjectType === "independent_professional";
  const isB2B = claimSubjectType === "b2b_supplier";
  const requestedRole = requestedRoleForRelationship(contact.claimant_relationship);

  const missing = [];
  if (!isProfessional && !org.name?.trim()) missing.push(isB2B ? "Numele firmei" : "Numele organizatiei");
  if (isProfessional && !prof.full_name?.trim()) missing.push("Numele complet");
  if (isProfessional && !prof.professional_type) missing.push("Profesia");
  if (!loc.provider_type || !loc.provider_profile_type) missing.push("Tipul profilului");
  if (!loc.locality_siruta_code) missing.push("Localitatea");
  if (!loc.address?.trim()) missing.push("Adresa");
  if (!loc.phone_public?.trim() && !loc.public_email?.trim()) missing.push("Telefon sau email public");
  if (!contact.contact_name?.trim()) missing.push("Numele solicitantului");
  if (!contact.email?.trim()) missing.push("Emailul solicitantului");
  if (!contact.claimant_relationship) missing.push("Relatia solicitantului");
  if (!contact.representation_confirmed) missing.push("Confirmarea reprezentarii");

  return (
    <div className="text-left">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {isProfessional ? "Profil profesional si locatie" : isB2B ? "Firma si profil B2B" : "Organizatie si locatie"}
        </div>
        {isProfessional ? <Row label="Nume profesional" value={prof.full_name} /> : <Row label={isB2B ? "Firma" : "Organizatie"} value={org.name} />}
        {isProfessional && <Row label="Profesie" value={PROFESSION_LABELS[prof.professional_type]} />}
        <Row label="Locatie / profil" value={loc.name || prof.full_name} />
        <Row label="Tip" value={PROVIDER_TYPES[loc.provider_type] || loc.provider_profile_type} />
        <Row label="Localitate" value={`${loc.city}${loc.county ? ", " + loc.county : ""}`} />
        <Row label="Adresa" value={loc.address} />
        <Row label="Telefon public" value={loc.phone_public} />
        <Row label="Email public" value={loc.public_email} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Date private si acces</div>
        <Row label="Nume" value={contact.contact_name} />
        <Row label="Relatie" value={CLAIMANT_RELATIONSHIPS[contact.claimant_relationship]} />
        <Row label="Rol solicitat" value={MEMBERSHIP_ROLE_LABELS[requestedRole]} />
        <Row label="Email" value={contact.email} />
        <Row label="Telefon" value={contact.phone} />
        <Row label="Verificare" value={VERIFICATION_LABELS[contact.verification_method] || VERIFICATION_LABELS.manual_review} />
      </div>

      {missing.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <div className="font-semibold">Mai ai cateva lucruri de completat:</div>
            <ul className="mt-1 list-disc list-inside">{missing.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Profilul nu este publicat automat. Prin trimitere confirmi datele si accepti <Link to="/termeni" className="underline underline-offset-2">Termenii</Link> si <Link to="/confidentialitate" className="underline underline-offset-2">Politica de confidentialitate</Link>.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} disabled={missing.length > 0} loading={submitting}>Trimite spre verificare</ContinueButton>
    </div>
  );
}
