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
import WizPublicProfile from "@/components/provider/steps/WizPublicProfile";
import WizReview from "@/components/provider/steps/WizReview";
import IdentityDuplicatePanel from "@/components/provider/IdentityDuplicatePanel";

const STEPS = [
  { key: "org", title: "Confirma relatia cu locatia", subtitle: "Cum se numeste organizatia si aceasta locatie? Trebuie sa fii conectat la aceasta afacere.", Comp: WizOrg },
  { key: "type", title: "Tip de furnizor", subtitle: "Alege categoria care descrie cel mai bine locatia.", Comp: WizType },
  { key: "contact", title: "Date de contact", subtitle: "Datele devin publice doar dupa verificare.", Comp: WizContact },
  { key: "publicProfile", title: "Profil public", subtitle: "Vei putea vedea ce date sunt in review.", Comp: WizPublicProfile },
  { key: "services", title: "Servicii oferite", subtitle: "Serviciile trimise aici nu devin automat confirmate sau vizibile public.", Comp: WizServices },
  { key: "specs", title: "Specializari", subtitle: "Optional — alege specializarile relevante.", Comp: WizSpecs },
  { key: "facilities", title: "Dotari si servicii tehnice", subtitle: "Optional — laborator, atelier, montaj.", Comp: WizFacilities },
  { key: "team", title: "Echipa", subtitle: "Adauga profesionistii din locatie (optional).", Comp: WizTeam },
  { key: "schedule", title: "Program si disponibilitate", subtitle: "Programul de lucru al locatiei.", Comp: WizSchedule },
  { key: "identity", title: "Datele tale", subtitle: "Datele tale de contact pentru verificare.", Comp: WizIdentity },
  { key: "review", title: "Revizuire", subtitle: "Mai ai cateva lucruri de completat? Verifica inainte de trimitere.", Comp: WizReview },
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

// Module 3H.1B.2: minimum temporary session state to resume the wizard after login.
export const WIZARD_RESUME_KEY = "pending_new_location_wizard";
const readResume = () => {
  try {
    const raw = sessionStorage.getItem(WIZARD_RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export default function NewLocationWizard({ onDone, onExit, prefill, onClaimExisting }) {
  const [resume] = useState(readResume);
  const [data, setData] = useState(() =>
    resume?.data
      ? { ...INITIAL, ...resume.data }
      : prefill
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
  const [step, setStep] = useState(() =>
    resume?.data ? Math.min(Number(resume.step) || 0, STEPS.length - 1) : 0
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Module 3H.1B.1: identity gate result returned by the backend before creation.
  const [identityCheck, setIdentityCheck] = useState(null);

  const update = (patch) => setData((d) => ({ ...d, ...patch }));
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => (step === 0 ? onExit() : setStep((s) => s - 1));

  // After login: consume the resume state; re-run a pending submit automatically.
  React.useEffect(() => {
    if (!resume) return;
    sessionStorage.removeItem(WIZARD_RESUME_KEY);
    if (resume.pendingSubmit) {
      base44.auth.isAuthenticated().then((ok) => {
        if (ok) submit(resume.identityExtra || {});
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (identityExtra = {}) => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      // Save only in-session wizard state (no permanent drafts), then resume post-login.
      sessionStorage.setItem(WIZARD_RESUME_KEY, JSON.stringify({ data, step, pendingSubmit: true, identityExtra }));
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
            // Module 3H.1B.2: strong duplicates can only be escalated for admin
            // clarification — they never create a location, even when declared distinct.
            submit(strong ? { escalate_duplicate_review: true, identity_difference_note: note } : { identity_difference_note: note });
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