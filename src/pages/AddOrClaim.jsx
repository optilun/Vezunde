import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import NewLocationWizard from "@/components/provider/NewLocationWizard";

export default function AddOrClaim() {
  const [stage, setStage] = useState("search"); // search | claim | wizard | done
  const [selected, setSelected] = useState(null);

  if (stage === "wizard") {
    return <NewLocationWizard onDone={() => setStage("done")} onExit={() => setStage("search")} />;
  }

  return (
    <div className="max-w-xl mx-auto px-5 py-10 sm:py-14">
      {stage === "done" ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 mx-auto text-primary" />
          <h1 className="mt-5 font-heading text-2xl font-extrabold">Cererea ta este in verificare.</h1>
          <p className="mt-2 text-muted-foreground">Te vom anunta pe email dupa analizare.</p>
          <div className="mt-6 flex justify-center gap-4 text-sm">
            <Link to="/contul-meu" className="underline underline-offset-4">Vezi statusul in contul meu</Link>
            <Link to="/" className="underline underline-offset-4 text-muted-foreground">Inapoi acasa</Link>
          </div>
        </div>
      ) : stage === "claim" && selected ? (
        <>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Revendica aceasta locatie</h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base">Completeaza datele tale pentru verificare manuala.</p>
          <div className="mt-7">
            <ClaimForm location={selected} onDone={() => setStage("done")} onBack={() => setStage("search")} />
          </div>
        </>
      ) : (
        <>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Adauga sau revendica locatia ta</h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base">
            Cauta locatia in Vezunde. Daca exista deja, o poti revendica. Daca nu, o poti adauga.
          </p>
          <div className="mt-7">
            <ProviderSearch
              onClaim={(loc) => { setSelected(loc); setStage("claim"); }}
              onNew={() => setStage("wizard")}
            />
          </div>
        </>
      )}
    </div>
  );
}