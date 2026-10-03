import React, { useEffect, useState } from "react";
import { Check, Eye, Glasses, Loader2, ScanEye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import WizardShell from "@/components/intake/WizardShell";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { PROFESSIONAL_TYPE_ENTRIES, PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";

// 2026-09-03: lista de profesii si descrierile vin din shared/professionalIdentity.js. Aici raman
// doar pictogramele, care sunt o decizie de interfata, nu una de taxonomie. O profesie noua apare
// automat in acest ecran, cu o pictograma implicita, fara sa fie nevoie de o editare aici.
const TYPE_ICONS = {
  ophthalmologist: Eye,
  optometrist: ScanEye,
  optician: Glasses,
};

const PROFESSIONAL_TYPES = PROFESSIONAL_TYPE_ENTRIES.map((entry) => ({
  id: entry.code,
  icon: TYPE_ICONS[entry.code] || Eye,
  description: entry.patient_hint,
}));

export default function ProfessionalOnboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [professionalType, setProfessionalType] = useState("");
  const [fullName, setFullName] = useState(user?.full_name || user?.name || "");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const checkWorkspace = async () => {
      try {
        const response = await base44.functions.invoke("getMyProfessionalWorkspace", {});
        if (!active) return;
        if (response.data?.professional?.id) {
          navigate("/contul-meu?mode=professional&ps=overview", { replace: true });
          return;
        }
      } catch (workspaceError) {
        if (active) setError(workspaceError?.message || "Nu am putut verifica profilul profesional existent.");
      } finally {
        if (active) setChecking(false);
      }
    };
    checkWorkspace();
    return () => { active = false; };
  }, [navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!professionalType) {
      setError("Selectează tipul profesional.");
      return;
    }
    if (fullName.trim().length < 3) {
      setError("Completează numele profesional complet.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await base44.functions.invoke("manageMyProfessionalProfile", {
        action: "create_profile",
        professional_type: professionalType,
        full_name: fullName.trim(),
      });
      if (response.data?.error) throw new Error(response.data.error);
      navigate("/contul-meu?mode=professional&ps=profile&onboarding=created", { replace: true });
    } catch (submitError) {
      setError(submitError?.response?.data?.error || submitError?.message || "Profilul profesional nu a putut fi creat.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WizardShell
      split
      step={1}
      total={1}
      title="Creează profilul tău profesional"
      subtitle="Un profil al tău, pe care îl poți asocia ulterior cu locațiile unde lucrezi."
      onBack={() => navigate("/pentru-specialisti")}
      artworkTitle={["Un profil al tău.", "Oriunde", "lucrezi."]}
      artworkSubtitle="Oftalmolog, optometrist sau optician — prezintă clar cu ce îi poți ajuta pe clienți."
    >
      {checking ? (
        <div className="mt-10 flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Verificăm contul tău profesional...
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6">
          <fieldset>
            <legend className="text-sm font-semibold">Ce tip de specialist ești?</legend>
            <div className="mt-3 grid gap-3">
              {PROFESSIONAL_TYPES.map((item) => {
                const Icon = item.icon;
                const selected = professionalType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setProfessionalType(item.id)}
                    className={`relative flex w-full min-w-0 items-start gap-3 rounded-xl border p-4 pr-9 text-left transition-colors ${selected ? "border-foreground bg-foreground/[0.04]" : "border-border bg-card hover:border-foreground/35"}`}
                  >
                    {selected && <Check className="absolute right-4 top-4 h-4 w-4" />}
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-heading text-sm font-bold">{PROFESSIONAL_TYPE_LABELS[item.id]}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label htmlFor="professional-full-name" className="text-sm font-semibold">Numele profesional complet</label>
            <input
              id="professional-full-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              maxLength={120}
              autoComplete="name"
              className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-colors focus:border-foreground/50"
              placeholder="Nume și prenume"
            />
            <p className="mt-2 text-xs text-muted-foreground">Acesta este numele folosit pentru verificarea profilului.</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Ce se creează acum</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> Un profil profesional privat, în stadiu de ciornă.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> Acces la modul profesional din același cont VIASEE.</li>
              <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> Posibilitatea de asociere ulterioară cu locații.</li>
            </ul>
            <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Nu se creează o organizație și nu primești automat acces la administrarea unei locații. Profilul devine public numai după completare și verificare.
            </p>
          </div>

          {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
            <button type="button" onClick={() => navigate("/pentru-specialisti")} className="h-12 rounded-xl border border-border bg-card px-5 text-sm font-medium">
              Renunță
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Creează profilul profesional
            </button>
          </div>
        </form>
      )}
    </WizardShell>
  );
}
