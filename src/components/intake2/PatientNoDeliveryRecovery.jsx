import React, { useState } from "react";
import { Loader2, SearchCheck, ShieldCheck } from "lucide-react";
import PatientRecoveryStatusCard from "./PatientRecoveryStatusCard";
import { requestPatientRequestRecovery } from "@/lib/patientRequestPersistenceClient";

// 2026-10-09 (audit Top 3, T6; Alex: „1 + 2 + 3 întâi”). Cererea are rezultate, dar după trimitere
// nu a ajuns la nicio locație (niciuna nu primește încă cereri prin VIASEE). Până acum pacientul
// rămânea aici fără niciun pas următor; acum poate cere verificarea echipei, ca la cererile fără
// rezultate. Serverul decide dacă verificarea e permisă (getPatientRequestStatus).
export default function PatientNoDeliveryRecovery({ requestId, accessToken = "", coverageCounts = {}, onRecovered }) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(null);

  const submit = async () => {
    if (!consent) {
      setError("Bifează acordul pentru verificarea internă.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await requestPatientRequestRecovery({
        requestId,
        explicitAccessToken: accessToken,
        coverageCounts: coverageCounts || {},
      });
      setRecovery(data?.recovery || null);
      onRecovered?.(data);
    } catch (recoveryError) {
      setError(recoveryError?.message || "Verificarea nu a putut fi solicitată. Încearcă din nou.");
    } finally {
      setBusy(false);
    }
  };

  if (recovery) return <PatientRecoveryStatusCard recovery={recovery} />;

  return (
    <section data-component="PatientNoDeliveryRecovery" className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <SearchCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h2 className="font-heading text-base font-extrabold text-foreground">Cererea nu a ajuns la nicio locație</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Locațiile găsite nu primesc încă cereri prin VIASEE. Le poți contacta direct, de pe profil, sau echipa VIASEE îți poate verifica cererea și te poate ajuta să găsești o locație potrivită.
          </p>
        </div>
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span className="text-xs leading-relaxed text-muted-foreground">
          Solicit verificarea internă a cererii de către echipa VIASEE. Înțeleg că nicio locație nu primește automat cererea.
        </span>
      </label>
      {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
        {busy ? "Trimitem solicitarea..." : "Cere ajutorul echipei VIASEE"}
      </button>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        Verificarea nu promite identificarea unei locații sau un termen de răspuns.
      </p>
    </section>
  );
}
