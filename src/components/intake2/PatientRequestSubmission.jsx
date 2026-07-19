import React, { useRef, useState } from "react";
import { BookmarkPlus, CheckCircle2, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
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
      properties: {
        analytics_version: "patient-request-v1",
        ...properties,
      },
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

export default function PatientRequestSubmission({ results, meta }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [distributionConsent, setDistributionConsent] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributionError, setDistributionError] = useState("");
  const [distributionResult, setDistributionResult] = useState(null);
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    preference: "email",
  });
  const idempotencyKeyRef = useRef(createPatientRequestIdempotencyKey());

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
        contact,
        results,
        meta,
      });
      setSuccess(data);
      track("patient_request_saved", {
        idempotent_replay: data.idempotent_replay === true,
        match_count: Number(data.match_count) || 0,
        top3_count: Number(data.top3_count) || 0,
        contact_sharing_enabled: data.contact_sharing_enabled === true,
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
      setDistributionError("Este necesar acordul pentru trimiterea cererii redacționate.");
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
        contact_sharing_enabled: data.contact_sharing_enabled === true,
        conversation_enabled: data.conversation_enabled === true,
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
      <div className="mt-7 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground">Cererea a fost salvată</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Referință: <span className="font-semibold text-foreground">{success.public_reference || "indisponibilă"}</span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Datele tale de contact nu au fost transmise niciunui furnizor.
            </p>

            {!distributionResult ? (
              <div className="mt-5 border-t border-primary/15 pt-5">
                <h4 className="text-sm font-bold text-foreground">Trimite cererea către locațiile eligibile</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Locațiile eligibile vor vedea doar categoria, localitatea, momentul și serviciile relevante. Numele, emailul, telefonul și mesajul tău original rămân ascunse.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
                  <input
                    type="checkbox"
                    checked={distributionConsent}
                    onChange={(event) => setDistributionConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border"
                  />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    Sunt de acord ca VIASEE să trimită un rezumat fără date de contact către locațiile eligibile. Distribuirea datelor de contact va necesita un acord separat.
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
                  {isDistributing ? "Pregătim cererea..." : "Trimite rezumatul cererii"}
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
                  Datele de contact și conversația rămân blocate.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="mt-7 rounded-2xl border border-border bg-secondary/30 p-5">
        <div className="flex items-start gap-3">
          <BookmarkPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-foreground">Continuă cu o cerere salvată</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Păstrezi nevoia, răspunsurile și rezultatele găsite. Nu trimitem datele tale către furnizori în această etapă.
            </p>
            <button
              type="button"
              onClick={openForm}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Salvează cererea
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
          <h3 className="text-sm font-bold text-foreground">Date pentru cererea ta</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Aceste date sunt păstrate separat de rezultatele publice și nu sunt vizibile furnizorilor.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-foreground">
          Nume
          <input
            required
            value={contact.name}
            onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))}
            autoComplete="name"
            maxLength={120}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="text-xs font-semibold text-foreground">
          Email
          <input
            required
            type="email"
            value={contact.email}
            onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))}
            autoComplete="email"
            maxLength={254}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="text-xs font-semibold text-foreground">
          Telefon <span className="font-normal text-muted-foreground">(opțional)</span>
          <input
            type="tel"
            value={contact.phone}
            onChange={(event) => setContact((current) => ({ ...current, phone: event.target.value }))}
            autoComplete="tel"
            maxLength={32}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
          />
        </label>
        <label className="text-xs font-semibold text-foreground">
          Preferință de contact
          <select
            value={contact.preference}
            onChange={(event) => setContact((current) => ({ ...current, preference: event.target.value }))}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal outline-none transition-colors focus:border-primary"
          >
            <option value="email">Email</option>
            <option value="phone">Telefon</option>
            <option value="either">Email sau telefon</option>
          </select>
        </label>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border"
        />
        <span className="text-xs leading-relaxed text-muted-foreground">
          Sunt de acord ca VIASEE să prelucreze datele de mai sus și răspunsurile din chestionar pentru a salva această cerere. Datele nu sunt transmise furnizorilor fără o confirmare separată.
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="h-4 w-4" />
          {isSubmitting ? "Salvăm cererea..." : "Confirmă și salvează"}
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            setIsOpen(false);
            setError("");
          }}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
        >
          Renunță
        </button>
      </div>
    </form>
  );
}
