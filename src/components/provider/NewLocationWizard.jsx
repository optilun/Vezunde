import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import WizardShell from "@/components/intake/WizardShell";
import WizSubjectType from "@/components/provider/steps/WizSubjectType";
import WizOrgBasics from "@/components/provider/steps/WizOrgBasics";
import WizProfessionalBasics from "@/components/provider/steps/WizProfessionalBasics";
import WizReviewShort from "@/components/provider/steps/WizReviewShort";
import IdentityDuplicatePanel from "@/components/provider/IdentityDuplicatePanel";

// Module 3H.1B.3.UI: routes to the org/B2B or professional basics screen based on
// the subject type chosen on the first step.
function WizDetails(props) {
  return props.data.claimSubjectType === "independent_professional"
    ? <WizProfessionalBasics {...props} />
    : <WizOrgBasics {...props} />;
}

// Module 3H.1B.3.UI: short new-location flow — 3 screens before submit.
const STEPS = [
  { key: "subject", title: "Cum vrei sa apari pe Vezunde?", subtitle: "Alege optiunea care descrie cel mai bine activitatea ta.", Comp: WizSubjectType },
  { key: "details", title: "Datele de baza", subtitle: "Aceste date sunt suficiente pentru trimiterea cererii.", Comp: WizDetails },
  { key: "review", title: "Revizuieste solicitarea", subtitle: "Verifica datele inainte de trimitere.", Comp: WizReviewShort },
];

const INITIAL = {
  claimSubjectType: "",
  organization: { name: "" },
  professional: { full_name: "", professional_type: "" },
  location: { name: "", provider_type: "", provider_profile_type: "", city: "", county: "", locality_siruta_code: "", county_code: "", uat_code: "", uat_name: "", address: "", phone_public: "", public_email: "", place_id: "", lat: null, lng: null },
  contact: { contact_name: "", claimant_relationship: "", email: "", phone: "", representation_confirmed: false },
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
    const isProfessional = data.claimSubjectType === "independent_professional";
    setSubmitting(true);
    setError("");
    const res = await base44.functions
      .invoke("submitProviderClaim", {
        mode: "new_location",
        claim_subject_type: data.claimSubjectType,
        claimant_relationship: data.contact.claimant_relationship,
        organization: !isProfessional ? data.organization : undefined,
        professional: isProfessional ? data.professional : undefined,
        // Independent professionals may leave the location name blank in the
        // UI — default it silently to satisfy the existing required field.
        location: { ...data.location, name: data.location.name || (isProfessional ? data.professional.full_name : data.location.name) },
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
      {step === 1 && data.location.place_id ? (
        <p className="mb-5 text-xs rounded-lg border border-border bg-secondary px-3 py-2.5 text-muted-foreground">
          Date preluate de pe Google Maps. Verifica si corecteaza inainte de trimitere.
        </p>
      ) : null}
      <Comp data={data} update={update} next={next} onSubmit={() => submit()} submitting={submitting} error={error} />
    </WizardShell>
  );
}