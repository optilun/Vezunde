import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Eye, Glasses, Loader2, ScanEye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SpecialistsHeader from "@/components/specialists/SpecialistsHeader";
import SpecialistsFooter from "@/components/specialists/SpecialistsFooter";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";

const PROFESSIONAL_TYPES = [
  {
    id: "ophthalmologist",
    icon: Eye,
    description: "Medic specialist care diagnosticheaza si trateaza afectiunile oculare.",
  },
  {
    id: "optometrist",
    icon: ScanEye,
    description: "Specialist in evaluarea vederii, refractie si solutii optice.",
  },
  {
    id: "optician",
    icon: Glasses,
    description: "Specialist in consilierea, adaptarea si realizarea solutiilor optice.",
  },
];

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
      setError("Selecteaza tipul profesional.");
      return;
    }
    if (fullName.trim().length < 3) {
      setError("Completeaza numele profesional complet.");
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
    <div className="flex min-h-screen min-h-dvh flex-col bg-background text-foreground">
      <SpecialistsHeader />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto w-full max-w-3xl">
          <button
            type="button"
            onClick={() => navigate("/pentru-specialisti")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Inapoi la pagina pentru specialisti
          </button>

          <div className="mt-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Profil profesional VIASEE</p>
            <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              Creeaza profilul tau profesional
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Profilul iti apartine si ramane separat de orice organizatie. Il poti completa acum, iar asocierea cu una sau mai multe locatii se poate face ulterior.
            </p>
          </div>

          {checking ? (
            <div className="mt-10 flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Verificam contul tau profesional...
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-7">
              <fieldset>
                <legend className="text-sm font-semibold">Ce tip de specialist esti?</legend>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {PROFESSIONAL_TYPES.map((item) => {
                    const Icon = item.icon;
                    const selected = professionalType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setProfessionalType(item.id)}
                        className={`relative min-h-40 rounded-2xl border p-5 text-left transition-colors ${selected ? "border-foreground bg-foreground/[0.04]" : "border-border bg-card hover:border-foreground/35"}`}
                      >
                        {selected && <Check className="absolute right-4 top-4 h-4 w-4" />}
                        <Icon className="h-6 w-6" />
                        <div className="mt-4 font-heading text-base font-bold">{PROFESSIONAL_TYPE_LABELS[item.id]}</div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
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
                  placeholder="Nume si prenume"
                />
                <p className="mt-2 text-xs text-muted-foreground">Acesta este numele folosit pentru verificarea profilului.</p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Ce se creeaza acum</h2>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> Un profil profesional privat, in stadiu de draft.</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> Acces la modul profesional din acelasi cont VIASEE.</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> Posibilitatea de asociere ulterioara cu locatii.</li>
                </ul>
                <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                  Nu se creeaza o organizatie si nu primesti automat acces la administrarea unei locatii. Profilul devine public numai dupa completare si verificare.
                </p>
              </div>

              {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}

              <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={() => navigate("/pentru-specialisti")} className="h-12 rounded-xl border border-border bg-card px-5 text-sm font-medium">
                  Renunta
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Creeaza profilul profesional
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      <SpecialistsFooter />
    </div>
  );
}
