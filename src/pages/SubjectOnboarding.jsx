import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import SpecialistsHeader from "@/components/specialists/SpecialistsHeader";
import SpecialistsFooter from "@/components/specialists/SpecialistsFooter";
import NewLocationWizard from "@/components/provider/NewLocationWizard";

export default function SubjectOnboarding({ subjectType }) {
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const backPath = subjectType === "b2b_supplier" ? "/parteneri" : "/pentru-specialisti";
  const isB2B = subjectType === "b2b_supplier";

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col workspace-neutral">
      <SpecialistsHeader />
      <main className="flex-1">
        {done ? (
          <div className="mx-auto max-w-xl px-5 py-16 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <h1 className="mt-5 font-heading text-2xl font-extrabold">Solicitarea a fost trimisa</h1>
            <p className="mt-2 text-sm text-muted-foreground">Profilul si accesul sunt analizate inainte de publicare.</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/contul-meu" className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background">Urmareste solicitarea</Link>
              <Link to={backPath} className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-semibold">Inapoi</Link>
            </div>
          </div>
        ) : (
          <NewLocationWizard
            initialSubjectType={subjectType}
            onDone={() => setDone(true)}
            onExit={() => navigate(backPath)}
            onClaimExisting={(location) => navigate("/adauga-sau-revendica", { state: { selectedLocation: location } })}
          />
        )}
      </main>
      <div className="px-5 pb-4 text-center text-xs text-muted-foreground">
        {isB2B ? "Profilurile B2B sunt separate de cautarea pacientilor." : "Profilul profesional este separat de administrarea unei organizatii."}
      </div>
      <SpecialistsFooter />
    </div>
  );
}
