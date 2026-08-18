import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import NewLocationWizard from "@/components/provider/NewLocationWizard";
import WizardShell from "@/components/intake/WizardShell";
import SelectedLocationCard from "@/components/provider/SelectedLocationCard";

const PHASES = ["Gaseste profilul", "Confirma relatia", "Alege accesul", "Date private", "Revizuire"];
const STAGE_STEP = { relation: 2, scope: 3, contact: 4, review: 5 };
const STAGE_COPY = {
  relation: { title: "Care este relatia ta cu furnizorul?", subtitle: "Alege optiunea care descrie cel mai bine rolul tau." },
  scope: { title: "Ce vrei sa administrezi?", subtitle: "Confirma locatia, locatiile selectate sau intreaga organizatie." },
  contact: { title: "Date private de verificare", subtitle: "Aceste date sunt folosite pentru verificarea solicitarii si nu apar in profilul public." },
  review: { title: "Revizuieste solicitarea", subtitle: "Verifica aria de acces, rolul solicitat si datele private inainte de trimitere." },
};

const PENDING_NEW_LOCATION_KEY = "pending_new_location_wizard";
const PENDING_CLAIM_CONTACT_KEY = "pending_claim_contact";
const PENDING_CLAIM_LOCATION_KEY = "pending_claim_location";
const PENDING_CLAIM_SCOPE_KEY = "pending_claim_scope";
const PENDING_CLAIM_STEP_KEY = "pending_claim_step";

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch (_error) {
    return null;
  }
}

const readSessionValue = (key) => {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (_error) {
    return null;
  }
};

const readSessionJson = (key) => {
  try {
    const raw = readSessionValue(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
};

const getResumeClaimStep = (contact, scope, storedStep) => {
  if (!contact?.claimant_relationship || !contact?.representation_confirmed) return "relation";
  if (!scope?.claim_scope || storedStep === "scope") return "scope";
  if (!String(contact?.contact_name || "").trim() || !String(contact?.email || "").trim()) return "contact";
  if (storedStep === "contact") return "contact";
  return storedStep === "review" ? "review" : "scope";
};

const clearResumeState = () => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(PENDING_NEW_LOCATION_KEY);
    storage.removeItem(PENDING_CLAIM_CONTACT_KEY);
    storage.removeItem(PENDING_CLAIM_LOCATION_KEY);
    storage.removeItem(PENDING_CLAIM_SCOPE_KEY);
    storage.removeItem(PENDING_CLAIM_STEP_KEY);
  } catch (_error) {
    // Fluxul ramane utilizabil chiar daca browserul blocheaza stocarea temporara.
  }
};

export default function AddOrClaim() {
  const navigate = useNavigate();
  const { state: navState } = useLocation();
  const preselectedLocation = navState?.selectedLocation || null;
  const startWithNewLocation = navState?.startFlow === "new_location";

  const [resumedClaimLocation] = useState(() => readSessionJson(PENDING_CLAIM_LOCATION_KEY));
  const [resumedClaimContact] = useState(() => readSessionJson(PENDING_CLAIM_CONTACT_KEY));
  const [resumedClaimScope] = useState(() => readSessionJson(PENDING_CLAIM_SCOPE_KEY));
  const [resumedClaimStep] = useState(() => readSessionValue(PENDING_CLAIM_STEP_KEY));
  const initialSelectedLocation = preselectedLocation || resumedClaimLocation || null;

  const [stage, setStage] = useState(() => {
    if (readSessionValue(PENDING_NEW_LOCATION_KEY) || startWithNewLocation) return "wizard";
    if (resumedClaimLocation) return "claim";
    if (preselectedLocation) return "confirm";
    return "search";
  });
  const [selected, setSelected] = useState(initialSelectedLocation);
  const [draft, setDraft] = useState(null);
  // Aria propusa cand solicitarea porneste de la un card de organizatie (2026-08-18).
  const [preferredScope, setPreferredScope] = useState("");
  const [claimStep, setClaimStep] = useState(() => resumedClaimLocation
    ? getResumeClaimStep(resumedClaimContact, resumedClaimScope, resumedClaimStep)
    : "relation");

  const completeOnboardingRequest = (result = {}) => {
    clearResumeState();
    if (result.duplicate_review) {
      navigate("/contul-meu?mode=personal&s=requests&onboarding=duplicate-review", { replace: true });
      return;
    }
    navigate("/contul-meu?mode=applicant&onboarding=submitted", { replace: true });
  };

  const returnFromClaim = () => {
    if (preselectedLocation) {
      setStage("confirm");
      return;
    }
    clearResumeState();
    setSelected(null);
    setClaimStep("relation");
    setStage("search");
  };

  if (stage === "wizard") {
    return (
      <div className="workspace-neutral">
        <NewLocationWizard
          prefill={draft}
          onDone={completeOnboardingRequest}
          onExit={() => { clearResumeState(); setDraft(null); setStage("search"); }}
          onClaimExisting={(loc) => {
            clearResumeState();
            setSelected(loc);
            setDraft(null);
            setClaimStep("relation");
            setStage("claim");
          }}
        />
      </div>
    );
  }

  return (
    <div className="workspace-neutral">
      {stage === "confirm" && selected ? (
        <WizardShell phases={PHASES} phaseStep={1} title="Locatie selectata" subtitle="Confirma ca aceasta este locatia de la care porneste solicitarea.">
          <SelectedLocationCard
            location={selected}
            onContinue={() => { setClaimStep("relation"); setStage("claim"); }}
            onChangeLocation={() => { clearResumeState(); setSelected(null); setStage("search"); }}
          />
        </WizardShell>
      ) : stage === "claim" && selected ? (
        <WizardShell
          phases={PHASES}
          phaseStep={STAGE_STEP[claimStep] || 2}
          title={STAGE_COPY[claimStep]?.title || STAGE_COPY.relation.title}
          subtitle={STAGE_COPY[claimStep]?.subtitle || STAGE_COPY.relation.subtitle}
          onBack={() => {
            if (claimStep === "relation") returnFromClaim();
            else if (claimStep === "scope") setClaimStep("relation");
            else if (claimStep === "contact") setClaimStep("scope");
            else setClaimStep("contact");
          }}
        >
          <ClaimForm location={selected} step={claimStep} preferredScope={preferredScope} onStepChange={setClaimStep} onDone={completeOnboardingRequest} />
        </WizardShell>
      ) : (
        <WizardShell phases={PHASES} phaseStep={1} title="Gaseste profilul locatiei tale" subtitle="Verificam mai intai daca profilul exista deja.">
          <ProviderSearch
            onClaim={(loc, options) => {
              clearResumeState();
              setSelected(loc);
              setPreferredScope(options?.preferredScope || "");
              setClaimStep("relation");
              setStage("confirm");
            }}
            onNew={(d) => { clearResumeState(); setDraft(d && d.place_id ? d : null); setStage("wizard"); }}
          />
        </WizardShell>
      )}
    </div>
  );
}