import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import NewLocationWizard from "@/components/provider/NewLocationWizard";
import WizardShell from "@/components/intake/WizardShell";
import SelectedLocationCard from "@/components/provider/SelectedLocationCard";

// Module 3H.1B.3.UI: short claim flow — max 4 screens before submit.
const PHASES = ["Gaseste profilul", "Confirma relatia", "Date de contact", "Revizuire"];
const STAGE_STEP = { relation: 2, contact: 3, review: 4 };
const STAGE_COPY = {
  relation: { title: "Care este relatia ta cu aceasta locatie?", subtitle: "Alege optiunea care descrie cel mai bine legatura ta cu aceasta locatie." },
  contact: { title: "Date de contact", subtitle: "Vom folosi aceste date doar pentru verificarea solicitarii tale." },
  review: { title: "Revizuieste solicitarea", subtitle: "Verifica datele inainte de trimitere." },
};

// Module 3H.1B.2: explicit cancellation clears all temporary resume state.
const clearResumeState = () => {
  sessionStorage.removeItem("pending_new_location_wizard");
  sessionStorage.removeItem("pending_claim_contact");
  sessionStorage.removeItem("pending_claim_location");
};

export default function AddOrClaim() {
  // A location selected on the "Pentru specialisti" hero search is passed
  // via navigation state — skip the search step and confirm it instead.
  const { state: navState } = useLocation();
  const preselectedLocation = navState?.selectedLocation || null;

  // Resume the new-location wizard after a login redirect.
  const [stage, setStage] = useState(() => {
    if (sessionStorage.getItem("pending_new_location_wizard")) return "wizard";
    if (preselectedLocation) return "confirm";
    return "search";
  }); // search | confirm | claim | wizard | done
  const [selected, setSelected] = useState(preselectedLocation);
  const [draft, setDraft] = useState(null);
  const [claimStep, setClaimStep] = useState("relation");

  if (stage === "wizard") {
    return (
      <div className="workspace-neutral">
        <NewLocationWizard
          prefill={draft}
          onDone={() => setStage("done")}
          onExit={() => { clearResumeState(); setDraft(null); setStage("search"); }}
          onClaimExisting={(loc) => { setSelected(loc); setDraft(null); setClaimStep("relation"); setStage("claim"); }}
        />
      </div>
    );
  }

  return (
    <div className="workspace-neutral">
      {stage === "done" ? (
        <div className="max-w-xl mx-auto px-5 py-10 sm:py-14 text-center py-16">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
          <h1 className="mt-5 font-heading text-2xl font-extrabold">Solicitarea ta a fost trimisa spre verificare.</h1>
          <p className="mt-2 text-muted-foreground">Profilul nu va deveni public sau revendicat automat.</p>
          <p className="mt-1 text-muted-foreground">Te vom anunta daca avem nevoie de informatii suplimentare.</p>
          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link to="/contul-meu" className="underline underline-offset-4">Vezi statusul in contul meu</Link>
            <Link to="/" className="underline underline-offset-4 text-muted-foreground">Inapoi acasa</Link>
          </div>
        </div>
      ) : stage === "confirm" && selected ? (
        <WizardShell
          phases={PHASES}
          phaseStep={1}
          title="Locatie selectata"
          subtitle="Confirma ca aceasta este locatia pentru care vrei sa faci solicitarea."
        >
          <SelectedLocationCard
            location={selected}
            onContinue={() => { setClaimStep("relation"); setStage("claim"); }}
            onChangeLocation={() => { setSelected(null); setStage("search"); }}
          />
        </WizardShell>
      ) : stage === "claim" && selected ? (
        <WizardShell
          phases={PHASES}
          phaseStep={STAGE_STEP[claimStep]}
          title={STAGE_COPY[claimStep].title}
          subtitle={STAGE_COPY[claimStep].subtitle}
          onBack={() => {
            if (claimStep === "relation") setStage(preselectedLocation ? "confirm" : "search");
            else if (claimStep === "contact") setClaimStep("relation");
            else setClaimStep("contact");
          }}
        >
          <ClaimForm
            location={selected}
            step={claimStep}
            onStepChange={setClaimStep}
            onDone={() => setStage("done")}
          />
        </WizardShell>
      ) : (
        <WizardShell
          phases={PHASES}
          phaseStep={1}
          title="Gaseste profilul locatiei tale"
          subtitle="Verificam mai intai daca profilul exista deja."
        >
          <ProviderSearch
            onClaim={(loc) => { setSelected(loc); setClaimStep("relation"); setStage("claim"); }}
            onNew={(d) => { setDraft(d && d.place_id ? d : null); setStage("wizard"); }}
          />
        </WizardShell>
      )}
    </div>
  );
}