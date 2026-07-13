import React from "react";
import { AlertTriangle } from "lucide-react";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import { CLAIMANT_RELATIONSHIPS } from "@/components/provider/ContactIdentityFields";

const PROFESSION_LABELS = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value || "—"}</span>
  </div>
);

// Module 3H.1B.3.UI: review shows only initial-claim data — no services,
// team, schedule, photos or profile-enrichment fields. Submits via the same
// existing action (onSubmit), unchanged.
export default function WizReviewShort({ data, onSubmit, submitting, error }) {
  const { claimSubjectType, organization: org, professional: prof, location: loc, contact } = data;
  const isOrg = claimSubjectType === "organization";

  const missing = [];
  if (isOrg && !org.name?.trim()) missing.push("Numele organizatiei");
  if (!isOrg && !prof.full_name?.trim()) missing.push("Numele complet");
  if (!isOrg && !prof.professional_type) missing.push("Profesia");
  if (isOrg && !loc.provider_type) missing.push("Tipul locatiei");
  if (!loc.locality_siruta_code) missing.push("Localitatea");
  if (!loc.address?.trim()) missing.push("Adresa locatiei");
  if (!loc.phone_public?.trim() && !loc.public_email?.trim()) missing.push("Telefon sau email public");
  if (!contact.contact_name?.trim()) missing.push("Numele tau");
  if (!contact.email?.trim()) missing.push("Emailul tau");
  if (!contact.representation_confirmed) missing.push("Confirmarea reprezentarii");

  return (
    <div className="text-left">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {isOrg ? "Organizatie si locatie" : "Profesionist si locatie"}
        </div>
        {isOrg ? <Row label="Organizatie" value={org.name} /> : <Row label="Nume complet" value={prof.full_name} />}
        {!isOrg && <Row label="Profesie" value={PROFESSION_LABELS[prof.professional_type]} />}
        <Row label="Locatie / cabinet" value={loc.name} />
        {isOrg && <Row label="Tip locatie" value={PROVIDER_TYPES[loc.provider_type] || loc.provider_type} />}
        <Row label="Localitate" value={`${loc.city}${loc.county ? ", " + loc.county : ""}`} />
        <Row label="Adresa" value={loc.address} />
        <Row label="Telefon public" value={loc.phone_public} />
        <Row label="Email public" value={loc.public_email} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Datele tale</div>
        <Row label="Nume" value={contact.contact_name} />
        {isOrg && <Row label="Relatie" value={CLAIMANT_RELATIONSHIPS[contact.claimant_relationship]} />}
        <Row label="Email" value={contact.email} />
        <Row label="Telefon" value={contact.phone} />
      </div>

      {missing.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <div className="font-semibold">Mai ai cateva lucruri de completat:</div>
            <ul className="mt-1 list-disc list-inside">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Vei putea completa profilul dupa aprobarea solicitarii.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} disabled={missing.length > 0} loading={submitting}>
        Trimite spre verificare
      </ContinueButton>
    </div>
  );
}