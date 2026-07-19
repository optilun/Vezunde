import React from "react";
import { ArrowLeft, CheckCircle2, MapPin, Search } from "lucide-react";
import { storePatientRequestDraft } from "@/lib/patientRequestPersistenceClient";

function detailRows(draft) {
  const excluded = new Set(["categorie", "locatie"]);
  return (draft?.answers || []).filter((answer) => !excluded.has(answer.question_key));
}

export default function PatientRequestReview({ draft, onConfirm, onEdit }) {
  const rows = detailRows(draft);
  const handleConfirm = () => {
    storePatientRequestDraft(draft);
    onConfirm?.();
  };

  return (
    <div className="py-1 sm:py-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Verifică înainte de căutare
      </div>

      <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Am pregătit cererea ta
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Confirmă informațiile. VIASEE va folosi acest rezumat pentru a căuta locații eligibile, fără ca AI-ul să decidă ordinea rezultatelor.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-secondary/35 p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nevoie</p>
          <p className="mt-1 text-base font-semibold text-foreground">{draft?.intent_label || "Nu sunt sigur"}</p>
        </div>

        {draft?.city && (
          <div className="mt-4 flex items-start gap-2 border-t border-border/70 pt-4">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Localitate</p>
              <p className="mt-1 text-sm font-medium text-foreground">{draft.city}</p>
            </div>
          </div>
        )}

        {draft?.original_message && (
          <div className="mt-4 border-t border-border/70 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ai descris</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">„{draft.original_message}”</p>
          </div>
        )}

        {rows.length > 0 && (
          <dl className="mt-4 space-y-3 border-t border-border/70 pt-4">
            {rows.map((answer) => (
              <div key={answer.question_key} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-medium text-muted-foreground">{answer.question_label}</dt>
                <dd className="text-sm font-medium text-foreground sm:text-right">{answer.answer_label}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Search className="h-4 w-4" />
          Caută rezultate
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Modifică ultimul răspuns
        </button>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
        Contract chestionar: {draft?.questionnaire_version || "necunoscut"}
      </p>
    </div>
  );
}
