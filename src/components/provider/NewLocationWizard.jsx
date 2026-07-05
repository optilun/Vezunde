import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import WizardShell from "@/components/intake/WizardShell";
import WizOrg from "@/components/provider/steps/WizOrg";
import WizType from "@/components/provider/steps/WizType";
import WizContact from "@/components/provider/steps/WizContact";
import WizServices from "@/components/provider/steps/WizServices";
import WizSpecs from "@/components/provider/steps/WizSpecs";
import WizFacilities from "@/components/provider/steps/WizFacilities";
import WizTeam from "@/components/provider/steps/WizTeam";
import WizSchedule from "@/components/provider/steps/WizSchedule";
import WizIdentity from "@/components/provider/steps/WizIdentity";
import IdentityDuplicatePanel from "@/components/provider/IdentityDuplicatePanel";

const STEPS = [
  { key: "org", title: "Organizatie si locatie", subtitle: "Cum se numeste organizatia si aceasta locatie?", Comp: WizOrg },
  { key: "type", title: "Tip de furnizor", subtitle: "Alege categoria care descrie cel mai bine locatia.", Comp: WizType },
  { key: "contact", title: "Adresa si contact public", subtitle: "Datele publice afisate pacientilor.", Comp: WizContact },
  { key: "services", title: "Servicii oferite", subtitle: "Alege serviciile disponibile in aceasta locatie.", Comp: WizServices },
  { key: "specs", title: "Specializari", subtitle: "Optional — alege specializarile relevante.", Comp: WizSpecs },
  { key: "facilities", title: "Dotari si servicii tehnice", subtitle: "Optional — laborator, atelier, montaj.", Comp: WizFacilities },
  { key: "team", title: "Echipa", subtitle: "Adauga profesionistii din locatie (optional).", Comp: WizTeam },
  { key: "schedule", title: "Program si disponibilitate", subtitle: "Programul de lucru al locatiei.", Comp: WizSchedule },
  { key: "identity", title: "Identitate si trimitere", subtitle: "Datele tale de contact pentru verificare.", Comp: WizIdentity },
];

const INITIAL = {
  organization: { name: "", multi_location: false },
  location: { name: "", provider_type: "", provider_profile_type: "", city: "", county: "", locality_siruta_code: "", county_code: "", uat_code: "", uat_name: "", address: "", phone_public: "", public_email: "", website: "", description: "" },
  services: [],
  specializations: [],
  facilities: [],
  team: [],
  schedule: { opening_hours: "", saturday_hours: "", availability_status: "", availability_confirmed: false },
  contact: { contact_name: "", role: "", email: "", phone: "", representation_confirmed: false },
};

export default function NewLocationWizard({ onDone, onExit, prefill, onClaimExisting }) {
  const [data, setData] = useState(() =>
    prefill
      ? {
          ...INITIAL,
          location: {
            ...INITIAL.location,
            name: prefill.name || "",
            city: prefill.city || "",
            county: prefill.county || "",
            address: prefill.address || "",
            phone_public: prefill.phone || "",
            website: prefill.website || "",
            place_id: prefill.place_id || "",
            lat: typeof prefill.lat === "number" ? prefill.lat : null,
            lng: typeof prefill.lng === "number" ? prefill.lng : null,
          },
        }
      : INITIAL
  );
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Module 3H.1B.1: identity gate result returned by the backend before creation.
  const [identityCheck, setIdentityCheck] = useState(null);

  const update = (patch) => setData((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => (step === 0 ? onExit() : setStep((s) => s - 1));

  const submit = async (identityExtra = {}) => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await base44.functions
      .invoke("submitProviderClaim", {
        mode: "new_location",
        organization: data.organization,
        location: data.location,
        services: data.services,
        specializations: data.specializations,
        facilities: data.facilities,
        team: data.team,
        schedule: data.schedule,
        contact: data.contact,
        representation_confirmed: data.contact.representation_confirmed,
        ...identityExtra,
      })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSubmitting(false);
    if (res.data?.identity_check) { setIdentityCheck(res.data.identity_check); return; }
    if (res.data?.error) setError(res.data.error);
    else onDone();
  };

  if (identityCheck) {
    const strong = identityCheck.blocking_level === "strong_duplicate_review_required";
    return (
      <WizardShell step={STEPS.length} total={STEPS.length} title="Verificare identitate" subtitle="Am gasit profiluri asemanatoare in Vezunde." onBack={() => setIdentityCheck(null)}>
        <IdentityDuplicatePanel
          check={identityCheck}
          submitting={submitting}
          onClaim={(c) => onClaimExisting && onClaimExisting({ id: c.location_id, name: c.name, city: c.locality_name, county: c.county_name, address: c.address })}
          onContinueDistinct={(note) => {
            setIdentityCheck(null);
            submit(strong ? { declared_distinct: true, identity_difference_note: note } : { identity_difference_note: note });
          }}
          onCancel={() => setIdentityCheck(null)}
        />
      </WizardShell>
    );
  }

  const { title, subtitle, Comp } = STEPS[step];
  return (
    <WizardShell step={step + 1} total={STEPS.length} title={title} subtitle={subtitle} onBack={back}>
      {step === 0 && data.location.place_id ? (
        <p className="mb-5 text-xs rounded-lg border border-border bg-secondary px-3 py-2.5 text-muted-foreground">
          Date preluate de pe Google Maps. Verifica si corecteaza inainte de trimitere.
        </p>
      ) : null}
      <Comp data={data} update={update} next={next} onSubmit={() => submit()} submitting={submitting} error={error} />
    </WizardShell>
  );
}