import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import WizardShell from "@/components/intake/WizardShell";
import WizOrgBasics from "@/components/provider/steps/WizOrgBasics";
import WizClaimRelation from "@/components/provider/steps/WizClaimRelation";
import WizClaimContact from "@/components/provider/steps/WizClaimContact";
import WizReviewShort from "@/components/provider/steps/WizReviewShort";
import IdentityDuplicatePanel from "@/components/provider/IdentityDuplicatePanel";

const STEPS = [
  { key: "details", title: "Organizatia si prima locatie", subtitle: "Completeaza datele minime necesare pentru identificarea profilului.", Comp: WizOrgBasics },
  { key: "relation", title: "Care este rolul tau?", subtitle: "Relatia declarata stabileste nivelul de acces pe care il soliciti.", Comp: WizClaimRelation },
  { key: "contact", title: "Date private de verificare", subtitle: "Precompletam datele contului si le poti corecta inainte de trimitere.", Comp: WizClaimContact },
  { key: "review", title: "Revizuieste solicitarea", subtitle: "Verifica organizatia, locatia si accesul solicitat inainte de trimitere.", Comp: WizReviewShort },
];

const INITIAL = {
  claimSubjectType: "organization",
  organization: { name: "" },
  professional: { full_name: "", professional_type: "" },
  location: {
    name: "",
    provider_type: "",
    provider_profile_type: "",
    city: "",
    county: "",
    locality_siruta_code: "",
    county_code: "",
    uat_code: "",
    uat_name: "",
    address: "",
    phone_public: "",
    public_email: "",
    place_id: "",
    lat: null,
    lng: null,
  },
  contact: { contact_name: "", claimant_relationship: "", email: "", phone: "", representation_confirmed: false },
};

export const WIZARD_RESUME_KEY = "pending_new_location_wizard";

const readResume = () => {
  try {
    const raw = sessionStorage.getItem(WIZARD_RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
};

export default function NewLocationWizard({ onDone, onExit, prefill, onClaimExisting }) {
  const [resume] = useState(readResume);
  const [data, setData] = useState(() => {
    if (resume?.data) {
      return {
        ...INITIAL,
        ...resume.data,
        claimSubjectType: "organization",
        organization: { ...INITIAL.organization, ...(resume.data.organization || {}) },
        location: { ...INITIAL.location, ...(resume.data.location || {}) },
        contact: { ...INITIAL.contact, ...(resume.data.contact || {}) },
      };
    }
    if (prefill) {
      return {
        ...INITIAL,
        location: {
          ...INITIAL.location,
          name: prefill.name || "",
          city: prefill.city || "",
          county: prefill.county || "",
          address: prefill.address || "",
          phone_public: prefill.phone || "",
          place_id: prefill.place_id || "",
          lat: typeof prefill.lat === "number" ? prefill.lat : null,
          lng: typeof prefill.lng === "number" ? prefill.lng : null,
        },
      };
    }
    return INITIAL;
  });
  const [step, setStep] = useState(() => resume?.data ? Math.min(Number(resume.step) || 0, STEPS.length - 1) : 0);
  const [submitting, setSubmitting] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [error, setError] = useState("");
  const [identityCheck, setIdentityCheck] = useState(null);

  useEffect(() => {
    if (resume) sessionStorage.removeItem(WIZARD_RESUME_KEY);
  }, [resume]);

  useEffect(() => {
    let cancelled = false;
    base44.auth.isAuthenticated().then(async (authenticated) => {
      if (!authenticated || cancelled) return;
      const user = await base44.auth.me().catch(() => null);
      if (!user || cancelled) return;
      setData((current) => ({
        ...current,
        contact: {
          ...current.contact,
          contact_name: current.contact.contact_name || user.full_name || user.name || "",
          email: current.contact.email || user.email || "",
        },
      }));
    });
    return () => { cancelled = true; };
  }, []);

  const update = (patch) => setData((current) => ({ ...current, ...patch, claimSubjectType: "organization" }));

  const next = async () => {
    const currentKey = STEPS[step].key;
    if (currentKey === "relation") {
      const nextStep = Math.min(step + 1, STEPS.length - 1);
      sessionStorage.setItem(WIZARD_RESUME_KEY, JSON.stringify({ data, step: nextStep }));
      setAuthChecking(true);
      const authenticated = await base44.auth.isAuthenticated().catch(() => false);
      setAuthChecking(false);
      if (!authenticated) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      sessionStorage.removeItem(WIZARD_RESUME_KEY);
      setStep(nextStep);
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const back = () => (step === 0 ? onExit() : setStep((current) => current - 1));

  const submit = async (identityExtra = {}) => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      sessionStorage.setItem(WIZARD_RESUME_KEY, JSON.stringify({ data, step: STEPS.length - 1, identityExtra }));
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    setSubmitting(true);
    setError("");
    const res = await base44.functions
      .invoke("submitProviderClaim", {
        mode: "new_location",
        claim_subject_type: "organization",
        claimant_relationship: data.contact.claimant_relationship,
        organization: data.organization,
        location: data.location,
        contact: data.contact,
        representation_confirmed: data.contact.representation_confirmed,
        ...identityExtra,
      })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSubmitting(false);
    if (res.data?.identity_check) {
      setIdentityCheck(res.data.identity_check);
      return;
    }
    if (res.data?.error) setError(res.data.error);
    else onDone(res.data || {});
  };

  if (identityCheck) {
    const strong = identityCheck.blocking_level === "strong_duplicate_review_required";
    return (
      <WizardShell step={STEPS.length} total={STEPS.length} title="Verificare profil existent" subtitle="Am gasit profiluri asemanatoare in VIASEE." onBack={() => setIdentityCheck(null)}>
        <IdentityDuplicatePanel
          check={identityCheck}
          submitting={submitting}
          onClaim={(candidate) => onClaimExisting?.({
            id: candidate.location_id,
            name: candidate.name,
            city: candidate.locality_name,
            county: candidate.county_name,
            address: candidate.address,
          })}
          onContinueDistinct={(note) => {
            setIdentityCheck(null);
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
      <Comp
        data={data}
        update={update}
        next={next}
        onSubmit={() => submit()}
        submitting={submitting}
        loading={authChecking}
        error={error}
      />
    </WizardShell>
  );
}
