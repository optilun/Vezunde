import React, { useState } from "react";
import { Clock3, Expand, Loader2, RefreshCw, SlidersHorizontal } from "lucide-react";
import {
  buildPatientRequestReformulationSeed,
  createPatientRequestReformulationUrl,
  keepWaitingForPatientRequest,
} from "@/lib/patientNoResponseReviewClient";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PatientNoResponseReviewPanel({
  review,
  request,
  workspace,
  requestId,
  accessToken,
  onStatusChange,
}) {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  if (!review || !["waiting", "review_available"].includes(review.state)) return null;

  const startReformulation = (mode) => {
    try {
      const seed = buildPatientRequestReformulationSeed({ mode, request, workspace });
      window.location.assign(createPatientRequestReformulationUrl(seed));
    } catch (startError) {
      setError(startError?.message || "Căutarea nouă nu a putut fi pregătită.");
    }
  };

  const keepWaiting = async () => {
    setUpdating(true);
    setError("");
    try {
      const nextStatus = await keepWaitingForPatientRequest(requestId, accessToken || "");
      onStatusChange?.(nextStatus);
    } catch (updateError) {
      setError(updateError?.message || "Continuarea asteptarii nu a putut fi salvata.");
    } finally {
      setUpdating(false);
    }
  };

  if (review.state === "waiting") {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
            <Clock3 className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fereastra de raspuns</p>
            <h3 className="mt-1 text-sm font-extrabold text-foreground">Asteptam raspunsurile locatiilor</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Daca nu apare niciun raspuns, optiunile de revizuire devin disponibile {formatDate(review.review_after) ? `la ${formatDate(review.review_after)}` : "dupa fereastra initiala"}.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Pragul de 48 de ore este un reper operational VIASEE, nu un termen garantat pentru furnizori.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-300/70 bg-amber-50/70 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-900">
          <RefreshCw className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900/70">Niciun raspuns in fereastra initiala</p>
          <h3 className="mt-1 text-base font-extrabold text-foreground">Alege cum continui cererea</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Cererea ramane activa. VIASEE nu o extinde, nu o retrimite si nu o inchide automat.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => void keepWaiting()}
              disabled={updating || !review.can_keep_waiting}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background hover:opacity-90 disabled:opacity-60"
            >
              {updating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock3 className="h-3.5 w-3.5" />}
              Continua asteptarea
            </button>
            {review.can_expand_county && (
              <button
                type="button"
                onClick={() => startReformulation("county")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary"
              >
                <Expand className="h-3.5 w-3.5" /> Extinde in judet
              </button>
            )}
            <button
              type="button"
              onClick={() => startReformulation("criteria")}
              disabled={!review.can_reformulate}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Revizuieste criteriile
            </button>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Extinderea sau revizuirea pregateste o cautare noua. Cererea actuala ramane in istoric si continua separat pana cand o inchizi.
          </p>
          {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </section>
  );
}
