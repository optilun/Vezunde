import React, { useRef, useState } from "react";
import { BookmarkPlus, CheckCircle2, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PatientRequestEmailVerification from "./PatientRequestEmailVerification";
import RequestWorkspace from "./RequestWorkspace";
import {
  authorizePatientRequestDistribution,
  createPatientRequestIdempotencyKey,
  persistPatientRequest,
  readPatientRequestDraft,
} from "@/lib/patientRequestPersistenceClient";

function track(eventName, properties = {}) {
  try {
    base44.analytics.track({
      eventName,
      properties: { analytics_version: "patient-request-v2", ...properties },
    });
  } catch (_error) {
    // Persistence must not depend on analytics.
  }
}

function errorMessage(error) {
  return String(
    error?.response?.data?.error
    || error?.data?.error
    || error?.message
    || "Cererea nu a putut fi salvată.",
  );
}

export default function PatientRequestSubmission({ results, meta, onRequestCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [submittedDraft, setSubmittedDraft] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [distributionConsent, setDistributionConsent] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionError, setDistributionError] = useState("");
  const [distributionResult, setDistributionResult] = useState(null);
  const [detailedMessage, setDetailedMessage] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "", preference: "email" });
  const idempotencyKeyRef = useRef(createPatientRequestIdempotencyKey());
  const hasEmail = Boolean(contact.email.trim());

  const openForm = () => {
    setIsOpen(true);
    track("patient_request_save_started", {
      result_count: Array.isArray(results) ? results.length : 0,
      coverage_status: meta?.coverage_status || "unknown",
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const draft = readPatientRequestDraft();
    if (!draft) {
      setError("Rezumatul cererii nu mai este disponibil. Reia căutarea.");
      return;
    }
    if (!contact.email.trim() && !contact.phone.trim()) {
      setError("Completează cel puțin emailul sau numărul de telefon.");
      return;
    }
    if (detailedMessage.trim().length < 10) {
      setError("Descrie mai detaliat ce ai nevoie, în minimum 10 caractere.");
      return;
    }
    if (!consent) {
      setError("Este necesar acordul pentru salvarea cererii.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const data = await persistPatientRequest({
        idempotencyKey: idempotencyKeyRef.current,
        requestDraft: draft,
        detailedMessage,
        contact,
        results,
        meta,
      });
      onRequestCreated?.(data);
      setSubmittedDraft(draft);
      setSuccess(data);
      setEmailVerified(false);
      track("patient_request_saved", {
        idempotent_replay: data.idempotent_replay === true,
        match_count: Number(data.match_count) || 0,
        top3_count: Number(data.top3_count) || 0,
        contact_channel: hasEmail ? (contact.phone.trim() ? "email_and_phone" : "email") : "phone",
      });
    } catch (submissionError) {
      setError(errorMessage(submissionError));
      track("patient_request_save_failed", {
        field: submissionError?.field || submissionError?.response?.data?.field || "unknown",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const distribute = async () => {
    if (!distributionConsent) {
      setDistributionError("Este necesar acordul pentru trimiterea cererii.");
      return;
    }
    setIsDistributing(true);
    setDistributionError("");
    try {
      const data = await authorizePatientRequestDistribution(
        success.request_id,
        success.request_access_token || "",
      );
      setDistributionResult(data);
      track("patient_request_distribution_authorized", {
        lead_count: Number(data.lead_count) || 0,
        top3_full_detail_count: Number(data.top3_full_detail_count) || 0,
        email_verified: emailVerified,
      });
    } catch (distributionFailure) {
      setDistributionError(errorMessage(distributionFailure));
      track("patient_request_distribution_failed");
    } finally {
      setIsDistributing(false);
    }
  };

  if (success) {
    return (
      <>
        <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-foreground">Cererea a fost salvată</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Referință: <span className="font-semibold text-foreground">{success.public_reference || "indisponibilă"}</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Telefonul nu a fost transmis niciunui furnizor.
              </p>

              {hasEmail ? (
                <PatientRequestEmailVerification
                  requestId={success.request_id}
                  accessToken={success.request_access_token || ""}
                  onVerified={setEmailVerified}
                />
              ) : (
                <div className="mt-5 rounded-xl border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
                  Ai ales să continui doar cu telefonul. Adresa de email nu va fi afișată locațiilor. Telefonul rămâne ascuns până la acordul tău separat pentru fiecare locație.
                </div>
              )}

              {!distributionResult ? (
                <div className="mt-5 border-t border-primary/15 pt-5">
                  <h4 className="text-sm font-bold text-foreground">Trimite cererea către locațiile relevante</h4>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Toate locațiile eligibile văd un rezumat anonim. Doar locațiile Pro din Top 3 pot vedea numele, mesajul detaliat și emailul verificat. Telefonul rămâne ascuns și poate fi oferit ulterior numai cu acord separat pentru locația care îl solicită.
                  </p>
                  {hasEmail && !emailVerified && (
                    <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                      Poți trimite cererea și înainte de confirmarea emailului, dar adresa va rămâne ascunsă locațiilor până când o verifici.
                    </p>
                  )}
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
                    <input
                      type="checkbox"
                      checked={distributionConsent}
                      onChange={(event) => setDistributionConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-border"
                    />
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      Sunt de acord ca VIASEE să distribuie rezumatul cererii locațiilor eligibile și să permită locațiilor Pro din Top 3 accesul la numele meu, mesajul detaliat și emailul verificat. Numărul de telefon rămâne ascuns.
                    </span>
                  </label>
                  {distributionError && (
                    <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                      {distributionError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={isDistributing}
                    onClick={distribute}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <Send className="h-4 w-4" />
                    {isDistributing ? "Pregătim cererea..." : "Trimite cererea"}
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-primary/20 bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {Number(distributionResult.lead_count) > 0
                      ? `Cererea este disponibilă pentru ${distributionResult.lead_count} locații eligibile.`
                      : "Momentan nu există locații eligibile pentru distribuire."}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Locațiile sunt vizibile mai jos imediat. Răspunsurile și conversațiile apar separat pentru fiecare locație. Telefonul rămâne ascuns.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {distributionResult && (
          <RequestWorkspace
            requestId={success.request_id}
            accessToken={success.request_access_token || ""}
            publicReference={success.public_reference || ""}
            results={Array.isArray(results) ? results : []}
            meta={meta}
            requestDraft={submittedDraft}
            detailedMessage={detailedMessage}
          />
        )}
      </>
    );
  }

  if (!isOpen) {
    return (
      <div className="mt-7 rounded-2xl border border-border bg-secondary/30 p-5">
        <div className="flex items-start gap-3">
          <BookmarkPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground">Continuă cu o cerere</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Adaugă un mesaj detaliat și datele prin care poți primi răspunsuri de la locațiile relevante.
            </p>
            <button
              type="button"
              onClick={openForm}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Continuă cererea
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-7 rounded-2xl border border-border bg-secondary/25 p-5">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Detaliile cererii</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Completează numele și cel puțin emailul sau telefonul. Telefonul nu este afișat automat niciunei locații.
          </p>
        </div>
      </div>

      <label className="mt-5 block text-xs font-semibold text-foreground">
        Descrie mai detaliat ce ai nevoie
        <textarea
          required
          value={detailedMessage}
          onChange={(event) => setDetailedMessage(event.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="De exemplu: ce problemă ai, ce produs sau serviciu cauți și orice detaliu util pentru locație."
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-normal outline-none transition-colors focus:border-primary"
        />
        <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Acest mesaj este vizibil numai locațiilor Pro din Top 3.</span>
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-foreground">
          Nume și prenume
          <input required value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} autoComplete="name" maxLength={120} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary" />
        </label>
        <label className="text-xs font-semibold text-foreground">
          Email <span className="font-normal text-muted-foreground">(email sau telefon obligatoriu)</span>
          <input type="email" value={contact.email} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} autoComplete="email" maxLength={254} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary" />
        </label>
        <label className="text-xs font-semibold text-foreground">
          Telefon <span className="font-normal text-muted-foreground">(email sau telefon obligatoriu)</span>
          <input type="tel" value={contact.phone} onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" maxLength={32} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary" />
        </label>
        <label className="text-xs font-semibold text-foreground">
          Preferință de contact
          <select value={contact.preference} onChange={(event) => setContact((current) => ({ ...current, preference: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary">
            <option value="email">Email</option>
            <option value="phone">Telefon</option>
            <option value="either">Email sau telefon</option>
          </select>
        </label>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
        <span className="text-xs leading-relaxed text-muted-foreground">
          Sunt de acord ca VIASEE să prelucreze datele și răspunsurile mele pentru a salva cererea. Distribuirea către locații se face numai după confirmarea separată din pasul următor.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
          <ShieldCheck className="h-4 w-4" />
          {isSubmitting ? "Salvăm cererea..." : "Confirmă și salvează"}
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => { setIsOpen(false); setError(""); }} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60">
          Renunță
        </button>
      </div>
    </form>
  );
}
