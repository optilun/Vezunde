import React from "react";
import { AlertTriangle } from "lucide-react";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROVIDER_TYPES, SERVICES, FACILITIES } from "@/lib/vezunde";
import { SPECIALIZATIONS, TEAM_ROLES, AVAILABILITY_OPTIONS } from "@/lib/providerTaxonomy";
import { CLAIMANT_RELATIONSHIPS } from "@/components/provider/ContactIdentityFields";

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-border last:border-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-right">{value || "—"}</span>
  </div>
);

// Module 3H.1B.UI: final review — summary only. Submits via the same existing
// submit action passed down as onSubmit; no new submission path.
export default function WizReview({ data, onSubmit, submitting, error }) {
  const { organization: org, location: loc, services, specializations, facilities, team, schedule, contact } = data;

  const missing = [];
  if (!org.name?.trim()) missing.push("Numele organizatiei");
  if (!loc.name?.trim()) missing.push("Numele locatiei");
  if (!loc.provider_type) missing.push("Tipul de furnizor");
  if (!loc.locality_siruta_code) missing.push("Localitatea");
  if (!loc.address?.trim()) missing.push("Adresa locatiei");
  if (!loc.phone_public?.trim() && !loc.public_email?.trim()) missing.push("Telefon sau email public");
  if (!contact.contact_name?.trim()) missing.push("Numele tau");
  if (!contact.email?.trim()) missing.push("Emailul tau");
  if (!contact.claimant_relationship) missing.push("Relatia ta cu locatia");
  if (!contact.representation_confirmed) missing.push("Confirmarea reprezentarii");

  return (
    <div className="text-left">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Organizatie si locatie</div>
        <Row label="Organizatie" value={org.name} />
        <Row label="Locatie" value={loc.name} />
        <Row label="Tip furnizor" value={PROVIDER_TYPES[loc.provider_type] || loc.provider_type} />
        <Row label="Localitate" value={`${loc.city}${loc.county ? ", " + loc.county : ""}`} />
        <Row label="Adresa" value={loc.address} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Profil public</div>
        <Row label="Telefon public" value={loc.phone_public} />
        <Row label="Email public" value={loc.public_email} />
        <Row label="Website" value={loc.website} />
        <Row label="Descriere" value={loc.description} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Servicii</div>
        <Row label="Servicii" value={services.map((k) => SERVICES[k] || k).join(", ") || "Niciunul"} />
        <Row label="Specializari" value={specializations.map((k) => SPECIALIZATIONS[k] || k).join(", ") || "Niciuna"} />
        <Row label="Dotari" value={facilities.map((k) => FACILITIES[k] || k).join(", ") || "Niciuna"} />
        <Row label="Echipa" value={team.map((m) => `${m.full_name} (${TEAM_ROLES[m.role] || m.role})`).join(", ") || "Nicio persoana"} />
        <Row label="Program" value={schedule.opening_hours} />
        <Row label="Disponibilitate" value={schedule.availability_confirmed ? AVAILABILITY_OPTIONS[schedule.availability_status] : "Nepublicata"} />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 mt-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Datele tale</div>
        <Row label="Nume" value={contact.contact_name} />
        <Row label="Relatie" value={CLAIMANT_RELATIONSHIPS[contact.claimant_relationship]} />
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
        Cererea ta va fi verificata manual de echipa Vezunde. Vei fi anuntat pe email dupa analiza.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <ContinueButton onClick={onSubmit} disabled={missing.length > 0} loading={submitting}>
        Trimite spre verificare
      </ContinueButton>
    </div>
  );
}