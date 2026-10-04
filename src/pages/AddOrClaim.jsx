import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import NewLocationWizard from "@/components/provider/NewLocationWizard";
import WizardShell from "@/components/intake/WizardShell";
import SelectedLocationCard from "@/components/provider/SelectedLocationCard";
import { clearClaimSearchSelection, readClaimSearchSelection } from "@/lib/claimSearchSelection";

const PHASES = ["Găsește profilul", "Confirmă relația", "Alege accesul", "Date private", "Revizuire"];
const STAGE_STEP = { relation: 2, scope: 3, contact: 4, review: 5 };
const STAGE_COPY = {
  relation: { title: "Care este relația ta cu furnizorul?", subtitle: "Alege opțiunea care descrie cel mai bine rolul tău." },
  scope: { title: "Ce vrei să administrezi?", subtitle: "Confirmă locația, locațiile selectate sau întreaga organizație." },
  contact: { title: "Date private de verificare", subtitle: "Aceste date sunt folosite pentru verificarea solicitării și nu apar în profilul public." },
  review: { title: "Revizuiește solicitarea", subtitle: "Verifică aria de acces, rolul solicitat și datele private înainte de trimitere." },
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
  clearClaimSearchSelection();
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
  const { state: routeState } = useLocation();
  const [savedSearchSelection] = useState(() => readClaimSearchSelection());
  const navState = routeState || savedSearchSelection;
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
  const [selectedOrganization, setSelectedOrganization] = useState(navState?.selectedOrganization || null);
  // 2026-10-04 (structura conturilor, pasul 5): cabinetul propriu al specialistului vine cu
  // datele din profilul profesional (sugestii editabile, nimic nu se trimite automat).
  const [draft, setDraft] = useState(() => navState?.newLocationPrefill || null);
  // Aria propusa cand solicitarea porneste de la un card de organizatie (2026-08-18).
  const [preferredScope, setPreferredScope] = useState(navState?.preferredScope || "");
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
    setSelectedOrganization(null);
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
            setSelectedOrganization(null);
            setPreferredScope("");
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
        <WizardShell split phases={PHASES} phaseStep={1} title={selectedOrganization ? "Organizație selectată" : "Locație selectată"} subtitle={selectedOrganization ? "Confirmă organizația. Alegi locațiile incluse la pasul de acces." : "Confirmă că aceasta este locația de la care pornește solicitarea."}>
          <SelectedLocationCard
            location={selected}
            organization={selectedOrganization}
            onContinue={() => { setClaimStep("relation"); setStage("claim"); }}
            onChangeLocation={() => { clearResumeState(); setSelected(null); setSelectedOrganization(null); setPreferredScope(""); setStage("search"); }}
          />
        </WizardShell>
      ) : stage === "claim" && selected ? (
        <WizardShell
          split
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
        <WizardShell split phases={PHASES} phaseStep={1} title="Găsește organizația sau locația" subtitle="Verificăm mai întâi dacă profilul există deja.">
          <ProviderSearch
            onClaim={(loc, options) => {
              clearResumeState();
              setSelected(loc);
              setSelectedOrganization(options?.selectedOrganization || null);
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