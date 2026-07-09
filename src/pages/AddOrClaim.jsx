import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderSearch from "@/components/provider/ProviderSearch";
import ClaimForm from "@/components/provider/ClaimForm";
import NewLocationWizard from "@/components/provider/NewLocationWizard";
import WizardShell from "@/components/intake/WizardShell";
import { PROVIDER_TYPES } from "@/lib/vezunde";

// Module 3H.1B.3.UI: short claim flow - max 4 screens before submit.
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
  const routeLocation = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSelectedLocationId = searchParams.get("location_id") || searchParams.get("selectedLocationId") || "";
  const stateLocation = routeLocation.state?.selectedLocation || null;

  // Resume the new-location wizard after a login redirect.
  const [stage, setStage] = useState(() =>
    sessionStorage.getItem("pending_new_location_wizard")
      ? "wizard"
      : (stateLocation || initialSelectedLocationId ? "selected" : "search")
  ); // search | selected | claim | wizard | done
  const [selected, setSelected] = useState(stateLocation);
  const [draft, setDraft] = useState(null);
  const [claimStep, setClaimStep] = useState("relation");
  const [selectedLoading, setSelectedLoading] = useState(!!initialSelectedLocationId && !stateLocation);
  const [selectedError, setSelectedError] = useState("");

  useEffect(() => {
    if (stateLocation || !initialSelectedLocationId) return;
    let active = true;
    setSelectedLoading(true);
    setSelectedError("");
    base44.functions
      .invoke("getClaimableProviderLocations", { location_id: initialSelectedLocationId })
      .then((res) => {
        if (!active) return;
        const loc = res.data?.locations?.[0] || null;
        if (loc) {
          setSelected(loc);
          setStage((current) => (current === "search" ? "selected" : current));
        } else {
          setSelectedError("Locatia selectata nu mai este disponibila pentru revendicare.");
          setStage("search");
        }
      })
      .catch(() => {
        if (!active) return;
        setSelectedError("Nu am putut incarca locatia selectata.");
        setStage("search");
      })
      .finally(() => {
        if (active) setSelectedLoading(false);
      });
    return () => { active = false; };
  }, [initialSelectedLocationId, stateLocation]);

  useEffect(() => {
    const raw = sessionStorage.getItem("pending_claim_location");
    if (!raw) return;
    let active = true;
    base44.auth.isAuthenticated().then((ok) => {
      if (!active || !ok) return;
      sessionStorage.removeItem("pending_claim_location");
      try {
        const loc = JSON.parse(raw);
        if (loc?.id) {
          setSelected(loc);
          setClaimStep("relation");
          setStage("selected");
          navigate("/adauga-sau-revendica?location_id=" + encodeURIComponent(loc.id), { replace: true, state: { selectedLocation: loc } });
        }
      } catch { /* ignore corrupt state */ }
    });
    return () => { active = false; };
  }, [navigate]);

  const selectedLocationCard = useMemo(() => {
    if (!selected) return null;
    const locality = selected.locality_name || selected.city;
    return (
      <div className="text-left">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">{selected.provider_type ? (PROVIDER_TYPES[selected.provider_type] || selected.provider_type) : "Profil furnizor"}</div>
          <div className="font-semibold">{selected.name}</div>
          {selected.organization_name && (
            <div className="text-xs text-muted-foreground">{selected.organization_name}</div>
          )}
          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="w-3.5 h-3.5" />
            {locality}{selected.address ? ", " + selected.address : ""}
          </div>
        </div>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => { setClaimStep("relation"); setStage("claim"); }}
            className="px-6 py-3 rounded-full text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: "#171717" }}
          >
            Continua
          </button>
          <button
            type="button"
            onClick={() => {
              clearResumeState();
              setSelected(null);
              setSelectedError("");
              setClaimStep("relation");
              setStage("search");
              navigate("/adauga-sau-revendica", { replace: true, state: null });
            }}
            className="px-6 py-3 rounded-full border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors"
          >
            Schimba locatia
          </button>
        </div>
      </div>
    );
  }, [navigate, selected]);

  if (stage === "wizard") {
    return (
      <div className="workspace-neutral">
        <NewLocationWizard
          prefill={draft}
          onDone={() => setStage("done")}
          onExit={() => { clearResumeState(); setDraft(null); setStage("search"); }}
          onClaimExisting={(loc) => {
            setSelected(loc);
            setDraft(null);
            setClaimStep("relation");
            setStage("selected");
            if (loc?.id) navigate("/adauga-sau-revendica?location_id=" + encodeURIComponent(loc.id), { replace: true, state: { selectedLocation: loc } });
          }}
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
      ) : stage === "selected" && (selected || selectedLoading) ? (
        <WizardShell
          phases={PHASES}
          phaseStep={1}
          title="Locatie selectata"
          subtitle="Aceasta este locatia pe care vrei sa o revendici."
          onBack={() => {
            clearResumeState();
            setSelected(null);
            setStage("search");
            navigate("/adauga-sau-revendica", { replace: true, state: null });
          }}
        >
          {selectedLoading ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Se incarca locatia selectata...
            </div>
          ) : selectedLocationCard}
        </WizardShell>
      ) : stage === "claim" && selected ? (
        <WizardShell
          phases={PHASES}
          phaseStep={STAGE_STEP[claimStep]}
          title={STAGE_COPY[claimStep].title}
          subtitle={STAGE_COPY[claimStep].subtitle}
          onBack={() => {
            if (claimStep === "relation") setStage("selected");
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
          {selectedError && (
            <p className="mb-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              {selectedError}
            </p>
          )}
          <ProviderSearch
            onClaim={(loc) => {
              setSelected(loc);
              setClaimStep("relation");
              setStage("selected");
              if (loc?.id) navigate("/adauga-sau-revendica?location_id=" + encodeURIComponent(loc.id), { replace: true, state: { selectedLocation: loc } });
            }}
            onNew={(d) => { setDraft(d && d.place_id ? d : null); setStage("wizard"); }}
          />
        </WizardShell>
      )}
    </div>
  );
}
