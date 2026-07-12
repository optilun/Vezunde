import React, { useCallback, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import WizardShell from "@/components/intake/WizardShell";
import OnboardingAuthGate from "@/components/provider/OnboardingAuthGate";
import WizSubjectType from "@/components/provider/steps/WizSubjectType";
import WizOrgBasics from "@/components/provider/steps/WizOrgBasics";
import WizProfessionalBasics from "@/components/provider/steps/WizProfessionalBasics";
import WizRepresentativeBasics from "@/components/provider/steps/WizRepresentativeBasics";
import WizReviewShort from "@/components/provider/steps/WizReviewShort";
import IdentityDuplicatePanel from "@/components/provider/IdentityDuplicatePanel";
import { requestedRoleForRelationship } from "@/components/provider/ContactIdentityFields";

export const WIZARD_RESUME_KEY = "pending_subject_onboarding_wizard";

const INITIAL = {
  claimSubjectType: "",
  organization: { name: "" },
  professional: { full_name: "", professional_type: "" },
  location: { name: "", provider_type: "", provider_profile_type: "", city: "", county: "", locality_siruta_code: "", county_code: "", uat_code: "", uat_name: "", address: "", phone_public: "", public_email: "", website: "", place_id: "", lat: null, lng: null },
  contact: { contact_name: "", claimant_relationship: "", email: "", phone: "", representation_confirmed: false, verification_method: "manual_review" },
};

function readResume() {
  try {
    const raw = sessionStorage.getItem(WIZARD_RESUME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearResume() {
  sessionStorage.removeItem(WIZARD_RESUME_KEY);
}

function buildInitial(prefill, initialSubjectType) {
  const base = {
    ...INITIAL,
    claimSubjectType: initialSubjectType || "",
    contact: {
      ...INITIAL.contact,
      claimant_relationship: initialSubjectType === "independent_professional" ? "owner" : "",
    },
  };
  if (!prefill) return base;
  return {
    ...base,
    organization: { ...base.organization, name: prefill.organization_name || prefill.name || "" },
    location: {
      ...base.location,
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
  };
}

export default function NewLocationWizard({ onDone, onExit, prefill, onClaimExisting, initialSubjectType = "" }) {
  const [resume] = useState(readResume);
  const [data, setData] = useState(() => resume?.data || buildInitial(prefill, initialSubjectType));
  const [stepKey, setStepKeyState] = useState(() => resume?.stepKey || (initialSubjectType ? "details" : "subject"));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [identityCheck, setIdentityCheck] = useState(null);

  const steps = useMemo(() => {
    const list = [];
    if (!initialSubjectType) list.push({ key: "subject", label: "Tip profil" });
    list.push(
      { key: "details", label: "Date publice" },
      { key: "auth", label: "Cont" },
      { key: "representative", label: "Verificare" },
      { key: "review", label: "Revizuire" },
    );
    return list;
  }, [initialSubjectType]);

  const persist = (nextData, nextStepKey) => {
    sessionStorage.setItem(WIZARD_RESUME_KEY, JSON.stringify({ data: nextData, stepKey: nextStepKey }));
  };
  const setStepKey = (next) => {
    setStepKeyState(next);
    persist(data, next);
  };
  const update = (patch) => {
    const next = { ...data, ...patch };
    if (patch.claimSubjectType === "independent_professional" && !next.contact.claimant_relationship) {
      next.contact = { ...next.contact, claimant_relationship: "owner" };
    }
    setData(next);
    persist(next, stepKey);
  };

  const currentIndex = Math.max(0, steps.findIndex((step) => step.key === stepKey));
  const phaseStep = currentIndex + 1;
  const phaseLabels = steps.map((step) => step.label);

  const goBack = () => {
    if (identityCheck) {
      setIdentityCheck(null);
      return;
    }
    if (currentIndex <= 0) {
      clearResume();
      onExit?.();
      return;
    }
    setStepKey(steps[currentIndex - 1].key);
  };

  const handleAuthenticated = useCallback((user) => {
    setData((current) => {
      const next = {
        ...current,
        contact: {
          ...current.contact,
          claimant_relationship: current.contact.claimant_relationship || (current.claimSubjectType === "independent_professional" ? "owner" : ""),
          contact_name: current.contact.contact_name || user?.full_name || user?.name || "",
          email: current.contact.email || user?.email || "",
        },
      };
      persist(next, "representative");
      return next;
    });
    setStepKeyState("representative");
  }, []);

  const submit = async (identityExtra = {}) => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) {
      setStepKey("auth");
      return;
    }
    const isProfessional = data.claimSubjectType === "independent_professional";
    const requestedRole = requestedRoleForRelationship(data.contact.claimant_relationship);
    setSubmitting(true);
    setError("");
    const response = await base44.functions.invoke("submitProviderClaim", {
      mode: "new_location",
      claim_subject_type: data.claimSubjectType,
      claimant_relationship: data.contact.claimant_relationship,
      requested_membership_role: requestedRole,
      verification_method: data.contact.verification_method || "manual_review",
      organization: !isProfessional ? data.organization : undefined,
      professional: isProfessional ? data.professional : undefined,
      location: { ...data.location, name: data.location.name || (isProfessional ? data.professional.full_name : data.location.name) },
      contact: data.contact,
      representation_confirmed: data.contact.representation_confirmed,
      ...identityExtra,
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSubmitting(false);
    if (response.data?.identity_check) {
      setIdentityCheck(response.data.identity_check);
      return;
    }
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    clearResume();
    onDone?.(response.data);
  };

  if (identityCheck) {
    const strong = identityCheck.blocking_level === "strong_duplicate_review_required";
    return (
      <WizardShell phases={phaseLabels} phaseStep={phaseLabels.length} title="Verificare identitate" subtitle="Am gasit profiluri asemanatoare in VIASEE." onBack={goBack}>
        <IdentityDuplicatePanel
          check={identityCheck}
          submitting={submitting}
          onClaim={(candidate) => onClaimExisting?.({ id: candidate.location_id, name: candidate.name, city: candidate.locality_name, county: candidate.county_name, address: candidate.address, claim_action: candidate.claim_action })}
          onContinueDistinct={(note) => {
            setIdentityCheck(null);
            submit(strong ? { escalate_duplicate_review: true, identity_difference_note: note } : { identity_difference_note: note });
          }}
          onCancel={() => setIdentityCheck(null)}
        />
      </WizardShell>
    );
  }

  if (stepKey === "auth") {
    return (
      <WizardShell phases={phaseLabels} phaseStep={phaseStep} title="Contul care va administra solicitarea" subtitle="Revii la urmatorul pas dupa autentificare. Solicitarea nu este trimisa automat." onBack={goBack}>
        <OnboardingAuthGate onAuthenticated={handleAuthenticated} />
      </WizardShell>
    );
  }

  if (stepKey === "subject") {
    return (
      <WizardShell phases={phaseLabels} phaseStep={phaseStep} title="Ce tip de profil vrei sa inscrii?" subtitle="Organizatiile pentru pacienti, specialistii si partenerii B2B au fluxuri separate." onBack={goBack}>
        <WizSubjectType data={data} update={update} next={() => setStepKey("details")} />
      </WizardShell>
    );
  }

  if (stepKey === "details") {
    const Details = data.claimSubjectType === "independent_professional" ? WizProfessionalBasics : WizOrgBasics;
    const title = data.claimSubjectType === "independent_professional" ? "Datele profesionale de baza" : data.claimSubjectType === "b2b_supplier" ? "Datele firmei si profilului B2B" : "Datele organizatiei";
    return (
      <WizardShell phases={phaseLabels} phaseStep={phaseStep} title={title} subtitle="Cerem acum numai datele publice necesare identificarii." onBack={goBack}>
        {data.location.place_id && <p className="mb-5 text-xs rounded-lg border border-border bg-secondary px-3 py-2.5 text-muted-foreground">Date preluate de pe Google Maps. Verifica si corecteaza inainte de trimitere.</p>}
        <Details data={data} update={update} next={() => setStepKey("auth")} />
      </WizardShell>
    );
  }

  if (stepKey === "representative") {
    return (
      <WizardShell phases={phaseLabels} phaseStep={phaseStep} title="Date private de verificare" subtitle="Aceste informatii nu apar pe profilul public." onBack={goBack}>
        <WizRepresentativeBasics data={data} update={update} next={() => setStepKey("review")} />
      </WizardShell>
    );
  }

  return (
    <WizardShell phases={phaseLabels} phaseStep={phaseStep} title="Revizuieste solicitarea" subtitle="Verifica datele inainte de trimitere." onBack={goBack}>
      <WizReviewShort data={data} onSubmit={() => submit()} submitting={submitting} error={error} />
    </WizardShell>
  );
}
