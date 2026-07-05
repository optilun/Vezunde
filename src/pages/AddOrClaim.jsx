import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import NewLocationWizard from "@/components/provider/NewLocationWizard";
import WizardShell from "@/components/intake/WizardShell";

// Module 3H.1B.UI: dynamic claim wizard shell — search/claim stages share the
// same phase-stepper visual language as NewLocationWizard's internal steps.
const PHASES = ["Gaseste profilul", "Confirma relatia", "Trimite"];

// Module 3H.1B.2: explicit cancellation clears all temporary resume state.
const clearResumeState = () => {
  sessionStorage.removeItem("pending_new_location_wizard");
  sessionStorage.removeItem("pending_claim_contact");
  sessionStorage.removeItem("pending_claim_location");
};

export default function AddOrClaim() {
  // Resume the new-location wizard after a login redirect.
  const [stage, setStage] = useState(() =>
    sessionStorage.getItem("pending_new_location_wizard") ? "wizard" : "search"
  ); // search | claim | wizard | done
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);

  if (stage === "wizard") {
    return (
      <div className="workspace-neutral">
        <NewLocationWizard
          prefill={draft}
          onDone={() => setStage("done")}
          onExit={() => { clearResumeState(); setDraft(null); setStage("search"); }}
          onClaimExisting={(loc) => { setSelected(loc); setDraft(null); setStage("claim"); }}
        />
      </div>
    );
  }

  return (
    <div className="workspace-neutral">
      {stage === "done" ? (
        <div className="max-w-xl mx-auto px-5 py-10 sm:py-14 text-center py-16">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
          <h1 className="mt-5 font-heading text-2xl font-extrabold">Cererea ta a fost trimisa spre verificare.</h1>
          <p className="mt-2 text-muted-foreground">Te vom anunta pe email dupa analizare.</p>
          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link to="/contul-meu" className="underline underline-offset-4">Vezi statusul in contul meu</Link>
            <Link to="/" className="underline underline-offset-4 text-muted-foreground">Inapoi acasa</Link>
          </div>
        </div>
      ) : stage === "claim" && selected ? (
        <WizardShell
          phases={PHASES}
          phaseStep={2}
          title="Confirma relatia cu locatia"
          subtitle="Completeaza datele tale pentru verificare manuala."
          onBack={() => setStage("search")}
        >
          <ClaimForm location={selected} onDone={() => setStage("done")} onBack={() => setStage("search")} />
        </WizardShell>
      ) : (
        <WizardShell
          phases={PHASES}
          phaseStep={1}
          title="Gaseste profilul locatiei tale"
          subtitle="Verificam mai intai daca profilul exista deja. Daca nu, il poti adauga."
        >
          <ProviderSearch
            onClaim={(loc) => { setSelected(loc); setStage("claim"); }}
            onNew={(d) => { setDraft(d && d.place_id ? d : null); setStage("wizard"); }}
          />
        </WizardShell>
      )}
    </div>
  );
}