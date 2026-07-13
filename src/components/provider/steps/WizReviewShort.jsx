import React from "react";
import { AlertTriangle } from "lucide-react";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import {
  CLAIMANT_RELATIONSHIPS,
  REQUESTED_ROLE_LABELS,
  requestedRoleForRelationship,
} from "@/components/provider/ContactIdentityFields";

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right break-words">{value || "—"}</span>
  </div>
);

export default function WizReviewShort({ data, onSubmit, submitting, error }) {
  const { organization: org, location: loc, contact } = data;
  const requestedRole = requestedRoleForRelationship(contact.claimant_relationship);
  const missing = [];
  if (!org.name?.trim()) missing.push("Numele organizatiei");
  if (!loc.name?.trim()) missing.push("Numele locatiei");
  if (!loc.provider_type) missing.push("Tipul locatiei");
  if (!loc.locality_siruta_code) missing.push("Localitatea");
  if (!loc.address?.trim()) missing.push("Adresa locatiei");
  if (!loc.phone_public?.trim() && !loc.public_email?.trim()) missing.push("Telefon sau email public");
  if (!contact.contact_name?.trim()) missing.push("Numele tau");
  if (!contact.email?.trim()) missing.push("Emailul tau");
  if (!contact.claimant_relationship) missing.push("Relatia cu organizatia");
  if (!contact.representation_confirmed) missing.push("Confirmarea reprezentarii");

  return (
    <div className="text-left">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Organizatie si locatie</div>
        <Row label="Organizatie" value={org.name} />
        <Row label="Locatie" value={loc.name} />
        <Row label="Tip locatie" value={PROVIDER_TYPES[loc.provider_type] || loc.provider_type} />
        <Row label="Localitate" value={`${loc.city}${loc.county ? ", " + loc.county : ""}`} />
        <Row label="Adresa" value={loc.address} />
        <Row label="Telefon public" value={loc.phone_public} />
        <Row label="Email public" value={loc.public_email} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Date private de verificare</div>
        <Row label="Nume" value={contact.contact_name} />
        <Row label="Relatie" value={CLAIMANT_RELATIONSHIPS[contact.claimant_relationship]} />
        <Row label="Acces solicitat" value={REQUESTED_ROLE_LABELS[requestedRole]} />
        <Row label="Email" value={contact.email} />
        <Row label="Telefon" value={contact.phone} />
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
        Dupa trimitere intri direct in zona de pregatire, unde poti continua configurarea profilului si a locatiei. Datele raman private pana la verificare.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} disabled={missing.length > 0} loading={submitting}>Trimite spre verificare</ContinueButton>
    </div>
  );
}
