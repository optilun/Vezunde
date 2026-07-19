import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import NewLocationWizard from "@/components/provider/NewLocationWizard";
import WizardShell from "@/components/intake/WizardShell";
import SelectedLocationCard from "@/components/provider/SelectedLocationCard";

const PHASES = ["Gaseste profilul", "Confirma relatia", "Date de contact", "Revizuire"];
const STAGE_STEP = { relation: 2, contact: 3, review: 4 };
const STAGE_COPY = {
  relation: { title: "Care este relatia ta cu aceasta locatie?", subtitle: "Alege optiunea care descrie cel mai bine legatura ta cu aceasta locatie." },
  contact: { title: "Date private de verificare", subtitle: "Aceste date sunt folosite pentru verificarea solicitarii si nu apar in profilul public." },
  review: { title: "Revizuieste solicitarea", subtitle: "Verifica locatia, accesul solicitat si datele private inainte de trimitere." },
};

const PENDING_NEW_LOCATION_KEY = "pending_new_location_wizard";
const PENDING_CLAIM_CONTACT_KEY = "pending_claim_contact";
const PENDING_CLAIM_LOCATION_KEY = "pending_claim_location";
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

const getResumeClaimStep = (contact, storedStep) => {
  if (!contact?.claimant_relationship || !contact?.representation_confirmed) return "relation";
  if (!String(contact?.contact_name || "").trim() || !String(contact?.email || "").trim()) return "contact";
  return storedStep || "review";
};

const clearResumeState = () => {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(PENDING_NEW_LOCATION_KEY);
    storage.removeItem(PENDING_CLAIM_CONTACT_KEY);
    storage.removeItem(PENDING_CLAIM_LOCATION_KEY);
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
  const [claimStep, setClaimStep] = useState(() => resumedClaimLocation ? getResumeClaimStep(resumedClaimContact, resumedClaimStep) : "relation");

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
        <WizardShell phases={PHASES} phaseStep={1} title="Locatie selectata" subtitle="Confirma ca aceasta este locatia pentru care vrei sa faci solicitarea.">
          <SelectedLocationCard
            location={selected}
            onContinue={() => { setClaimStep("relation"); setStage("claim"); }}
            onChangeLocation={() => { clearResumeState(); setSelected(null); setStage("search"); }}
          />
        </WizardShell>
      ) : stage === "claim" && selected ? (
        <WizardShell
          phases={PHASES}
          phaseStep={STAGE_STEP[claimStep]}
          title={STAGE_COPY[claimStep].title}
          subtitle={STAGE_COPY[claimStep].subtitle}
          onBack={() => {
            if (claimStep === "relation") returnFromClaim();
            else if (claimStep === "contact") setClaimStep("relation");
            else setClaimStep("contact");
          }}
        >
          <ClaimForm location={selected} step={claimStep} onStepChange={setClaimStep} onDone={completeOnboardingRequest} />
        </WizardShell>
      ) : (
        <WizardShell phases={PHASES} phaseStep={1} title="Gaseste profilul locatiei tale" subtitle="Verificam mai intai daca profilul exista deja.">
          <ProviderSearch
            onClaim={(loc) => { clearResumeState(); setSelected(loc); setClaimStep("relation"); setStage("confirm"); }}
            onNew={(d) => { clearResumeState(); setDraft(d && d.place_id ? d : null); setStage("wizard"); }}
          />
        </WizardShell>
      )}
    </div>
  );
}
