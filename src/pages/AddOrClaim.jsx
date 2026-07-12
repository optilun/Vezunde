import React, { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import OrganizationOnboardingWizard, { ORGANIZATION_ONBOARDING_RESUME_KEY } from "@/components/provider/OrganizationOnboardingWizard";
import OnboardingAuthGate from "@/components/provider/OnboardingAuthGate";
import WizardShell from "@/components/intake/WizardShell";
import SelectedLocationCard from "@/components/provider/SelectedLocationCard";

const CLAIM_PHASES = ["Profil", "Cont", "Acces", "Contact", "Revizuire"];
const CLAIM_STEP_NUMBER = { relation: 3, contact: 4, review: 5 };
const CLAIM_COPY = {
  relation: { title: "Ce relatie ai cu organizatia?", subtitle: "Relatia stabileste rolul pe care il soliciti." },
  contact: { title: "Date private de verificare", subtitle: "Aceste date nu apar pe profilul public." },
  review: { title: "Revizuieste solicitarea", subtitle: "Verifica profilul, accesul solicitat si datele de contact." },
};

const PENDING_CLAIM_CONTACT_KEY = "pending_claim_contact";
const PENDING_CLAIM_LOCATION_KEY = "pending_claim_location";
const PENDING_CLAIM_STEP_KEY = "pending_claim_step";

const readSessionJson = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getResumeClaimStep = (contact, storedStep) => {
  if (!contact?.claimant_relationship || !contact?.representation_confirmed) return "relation";
  if (!String(contact?.contact_name || "").trim() || !String(contact?.email || "").trim()) return "contact";
  return storedStep || "review";
};

const clearClaimResumeState = () => {
  sessionStorage.removeItem(PENDING_CLAIM_CONTACT_KEY);
  sessionStorage.removeItem(PENDING_CLAIM_LOCATION_KEY);
  sessionStorage.removeItem(PENDING_CLAIM_STEP_KEY);
};

const clearAllResumeState = () => {
  clearClaimResumeState();
  sessionStorage.removeItem(ORGANIZATION_ONBOARDING_RESUME_KEY);
};

export default function AddOrClaim() {
  const { state: navState } = useLocation();
  const preselectedLocation = navState?.selectedLocation || null;
  const initialNewLocationDraft = navState?.newLocationPrefill || null;
  const startNewFromNavigation = navState?.startNew === true;
  const [resumedClaimLocation] = useState(() => readSessionJson(PENDING_CLAIM_LOCATION_KEY));
  const [resumedClaimContact] = useState(() => readSessionJson(PENDING_CLAIM_CONTACT_KEY));
  const [resumedClaimStep] = useState(() => sessionStorage.getItem(PENDING_CLAIM_STEP_KEY));
  const [selected, setSelected] = useState(preselectedLocation || resumedClaimLocation || null);
  const [draft, setDraft] = useState(initialNewLocationDraft);
  const [currentUser, setCurrentUser] = useState(null);
  const [result, setResult] = useState(null);
  const [claimStep, setClaimStep] = useState(() => getResumeClaimStep(resumedClaimContact, resumedClaimStep));
  const [stage, setStage] = useState(() => {
    if (sessionStorage.getItem(ORGANIZATION_ONBOARDING_RESUME_KEY) || startNewFromNavigation) return "wizard";
    if (resumedClaimLocation || preselectedLocation) return "confirm";
    return "search";
  });

  const handleAuthenticated = useCallback((user) => {
    setCurrentUser(user);
    setClaimStep(getResumeClaimStep(readSessionJson(PENDING_CLAIM_CONTACT_KEY), sessionStorage.getItem(PENDING_CLAIM_STEP_KEY)));
    setStage("claim");
  }, []);

  const chooseLocation = (location) => {
    clearClaimResumeState();
    setSelected(location);
    setClaimStep("relation");
    setStage("confirm");
  };

  const startNew = (prefill) => {
    clearAllResumeState();
    setDraft(prefill && prefill.place_id ? prefill : null);
    setStage("wizard");
  };

  if (stage === "wizard") {
    return (
      <div className="workspace-neutral">
        <OrganizationOnboardingWizard
          prefill={draft}
          onDone={(response) => { clearAllResumeState(); setResult(response || {}); setStage("done"); }}
          onExit={() => { clearAllResumeState(); setDraft(null); setStage("search"); }}
          onClaimExisting={(location) => { clearAllResumeState(); setSelected(location); setClaimStep("relation"); setStage("confirm"); }}
        />
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="workspace-neutral">
        <div className="max-w-xl mx-auto px-5 py-16 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
          <h1 className="mt-5 font-heading text-2xl font-extrabold">Solicitarea a fost trimisa</h1>
          <p className="mt-2 text-muted-foreground">Status: In verificare</p>
          <p className="mt-1 text-sm text-muted-foreground">Profilul si accesul nu sunt aprobate automat. Poti urmari statusul si pregati datele disponibile din contul tau.</p>
          {result?.duplicate_review && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Solicitarea necesita clarificarea unui posibil profil duplicat.</p>}
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/contul-meu" className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background">Urmareste solicitarea</Link>
            <Link to="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold">Inapoi acasa</Link>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "confirm" && selected) {
    return (
      <div className="workspace-neutral">
        <WizardShell phases={CLAIM_PHASES} phaseStep={1} title="Confirma profilul selectat" subtitle="Verifica numele si adresa inainte de a continua.">
          <SelectedLocationCard
            location={selected}
            onContinue={() => setStage("auth")}
            onChangeLocation={() => { clearClaimResumeState(); setSelected(null); setStage("search"); }}
          />
        </WizardShell>
      </div>
    );
  }

  if (stage === "auth" && selected) {
    return (
      <div className="workspace-neutral">
        <WizardShell phases={CLAIM_PHASES} phaseStep={2} title="Contul care va administra solicitarea" subtitle="Autentificarea are loc inainte de colectarea datelor private de reprezentare." onBack={() => setStage("confirm")}>
          <OnboardingAuthGate onAuthenticated={handleAuthenticated} />
        </WizardShell>
      </div>
    );
  }

  if (stage === "claim" && selected) {
    return (
      <div className="workspace-neutral">
        <WizardShell
          phases={CLAIM_PHASES}
          phaseStep={CLAIM_STEP_NUMBER[claimStep]}
          title={CLAIM_COPY[claimStep].title}
          subtitle={CLAIM_COPY[claimStep].subtitle}
          onBack={() => {
            if (claimStep === "relation") setStage("auth");
            else if (claimStep === "contact") setClaimStep("relation");
            else setClaimStep("contact");
          }}
        >
          <ClaimForm
            location={selected}
            user={currentUser}
            step={claimStep}
            onStepChange={setClaimStep}
            onDone={(response) => { clearClaimResumeState(); setResult(response || {}); setStage("done"); }}
          />
        </WizardShell>
      </div>
    );
  }

  return (
    <div className="workspace-neutral">
      <WizardShell phases={CLAIM_PHASES} phaseStep={1} title="Gaseste organizatia sau locatia" subtitle="Cauta mai intai in director. Daca profilul exista, il revendici sau soliciti acces fara sa cream un duplicat.">
        <ProviderSearch onClaim={chooseLocation} onNew={startNew} />
      </WizardShell>
    </div>
  );
}
