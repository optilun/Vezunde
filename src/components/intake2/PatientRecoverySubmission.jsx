import React, { useRef, useState } from "react";
import { BookmarkPlus, CheckCircle2, Loader2, SearchCheck, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PatientRequestEmailVerification from "./PatientRequestEmailVerification";
import PatientRecoveryStatusCard from "./PatientRecoveryStatusCard";
import RequestWorkspace from "./RequestWorkspace";
import {
  createPatientRequestIdempotencyKey,
  persistPatientRequest,
  readPatientRequestDraft,
  requestPatientRequestRecovery,
} from "@/lib/patientRequestPersistenceClient";
import { buildPatientSafetyAssessment } from "@/lib/patientSafety";
import UrgencyInterruption from "./UrgencyInterruption";

function track(eventName, properties = {}) {
  try {
    base44.analytics.track({
      eventName,
      properties: { analytics_version: "patient-recovery-v1", ...properties },
    });
  } catch (_error) {
    // Patient continuation must not depend on analytics.
  }
}

function errorMessage(error, fallback) {
  return String(
    error?.response?.data?.error
    || error?.data?.error
    || error?.message
    || fallback,
  );
}

export default function PatientRecoverySubmission({ meta }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingConsent, setProcessingConsent] = useState(false);
  const [recoveryConsent, setRecoveryConsent] = useState(false);
  const [error, setError] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [success, setSuccess] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [submittedDraft, setSubmittedDraft] = useState(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [detailedMessage, setDetailedMessage] = useState("");
  // 2026-09-01: aceeasi lipsa ca in PatientRequestSubmission - mesajul detaliat nu trecea
  // prin nicio verificare de siguranta. Aici conteaza chiar mai mult: fluxul de recuperare
  // e folosit de pacienti care n-au primit raspuns, deci a trecut timp de la cererea
  // initiala si starea lor se poate sa se fi agravat intre timp.
  const [messageAssessment, setMessageAssessment] = useState(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "", preference: "email" });
  const idempotencyKeyRef = useRef(createPatientRequestIdempotencyKey());
  const hasEmail = Boolean(contact.email.trim());

  const openForm = () => {
    setIsOpen(true);
    track("patient_unmatched_recovery_started", {
      coverage_status: meta?.coverage_status || "unknown",
    });
  };

  const requestRecovery = async (savedRequest) => {
    setRecoveryError("");
    try {
      const data = await requestPatientRequestRecovery({
        requestId: savedRequest.request_id,
        explicitAccessToken: savedRequest.request_access_token || "",
        coverageCounts: meta?.coverage_counts || {},
      });
      setSnapshot(data);
      track("patient_unmatched_recovery_requested", {
        coverage_status: meta?.coverage_status || "unknown",
        idempotent_replay: data.idempotent_replay === true,
      });
      return data;
    } catch (requestError) {
      setRecoveryError(errorMessage(requestError, "Cererea a fost salvată, dar verificarea nu a putut fi solicitată."));
      track("patient_unmatched_recovery_failed", {
        coverage_status: meta?.coverage_status || "unknown",
      });
      return null;
    }
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
    const safety = buildPatientSafetyAssessment({ text: detailedMessage });
    if (safety.blocking) {
      setMessageAssessment(safety);
      setError("");
      return;
    }
    if (!processingConsent) {
      setError("Este necesar acordul pentru salvarea cererii.");
      return;
    }
    if (!recoveryConsent) {
      setError("Este necesar acordul separat pentru verificarea internă.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setRecoveryError("");
    try {
      const saved = await persistPatientRequest({
        idempotencyKey: idempotencyKeyRef.current,
        requestDraft: draft,
        detailedMessage,
        contact,
        results: [],
        meta,
      });
      setSuccess(saved);
      setSubmittedDraft(draft);
      setEmailVerified(false);
      track("patient_unmatched_request_saved", {
        coverage_status: meta?.coverage_status || "unknown",
        contact_channel: hasEmail ? (contact.phone.trim() ? "email_and_phone" : "email") : "phone",
      });
      await requestRecovery(saved);
    } catch (submissionError) {
      setError(errorMessage(submissionError, "Cererea nu a putut fi salvată."));
      track("patient_unmatched_request_save_failed", {
        coverage_status: meta?.coverage_status || "unknown",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mt-6 space-y-4">
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-foreground">Cererea a fost salvată</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Referință: <span className="font-semibold text-foreground">{success.public_reference || "indisponibilă"}</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Cererea nu a fost trimisă automat niciunei locații. Telefonul rămâne ascuns.
              </p>

              {hasEmail ? (
                <PatientRequestEmailVerification
                  requestId={success.request_id}
                  accessToken={success.request_access_token || ""}
                  onVerified={setEmailVerified}
                />
              ) : (
                <div className="mt-5 rounded-xl border border-border bg-background p-4 text-xs leading-relaxed text-muted-foreground">
                  Ai continuat doar cu telefonul. Verificarea poate fi urmărită din acest browser prin spațiul securizat al cererii.
                </div>
              )}

              {recoveryError && (
                <div className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 p-4">
                  <p role="alert" className="text-xs leading-relaxed text-amber-900">{recoveryError}</p>
                  <button
                    type="button"
                    onClick={() => void requestRecovery(success)}
                    className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background"
                  >
                    <SearchCheck className="h-3.5 w-3.5" /> Solicită din nou verificarea
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {snapshot?.recovery && <PatientRecoveryStatusCard recovery={snapshot.recovery} />}

        <RequestWorkspace
          requestId={success.request_id}
          accessToken={success.request_access_token || ""}
          publicReference={success.public_reference || ""}
          results={[]}
          meta={meta}
          requestDraft={submittedDraft}
          detailedMessage={detailedMessage}
        />
      </div>
    );
  }

  if (!isOpen) {
    return (
      <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <BookmarkPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground">Păstrează cererea și solicită o verificare VIASEE</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Poți salva aceeași cerere pentru o verificare internă a criteriilor și a datelor din director, fără să refaci formularul.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Cererea nu este trimisă automat furnizorilor, iar verificarea nu promite identificarea unei locații sau un termen de răspuns.
            </p>
            <button
              type="button"
              onClick={openForm}
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <SearchCheck className="h-4 w-4" /> Continuă cu verificarea
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (messageAssessment?.blocking) {
    return (
      <section className="mt-7">
        <UrgencyInterruption
          assessment={messageAssessment}
          onCorrect={() => setMessageAssessment(null)}
          correctLabel="Nu e o urgență, revin la cerere"
        />
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 rounded-2xl border border-border bg-secondary/25 p-5">
      <div className="flex items-start gap-3">
        <SearchCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Detaliile cererii pentru verificare</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Completează mesajul și datele prin care poți urmări cererea. Nicio locație nu primește automat aceste informații.
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
          placeholder="Adaugă detaliile importante despre serviciul sau ajutorul pe care îl cauți."
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-normal outline-none transition-colors focus:border-primary"
        />
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
        <input type="checkbox" checked={processingConsent} onChange={(event) => setProcessingConsent(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
        <span className="text-xs leading-relaxed text-muted-foreground">
          Sunt de acord ca VIASEE să prelucreze datele și răspunsurile mele pentru a salva cererea.
        </span>
      </label>

      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <input type="checkbox" checked={recoveryConsent} onChange={(event) => setRecoveryConsent(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border" />
        <span className="text-xs leading-relaxed text-muted-foreground">
          Solicit o verificare internă a cererii și a datelor disponibile în director. Înțeleg că cererea nu este trimisă automat furnizorilor și că verificarea nu garantează identificarea unei opțiuni.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="submit" disabled={isSubmitting} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {isSubmitting ? "Salvăm cererea..." : "Salvează și solicită verificarea"}
        </button>
        <button type="button" disabled={isSubmitting} onClick={() => { setIsOpen(false); setError(""); }} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground disabled:opacity-60">
          Renunță
        </button>
      </div>
    </form>
  );
}
