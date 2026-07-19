import React from "react";
import { AlertTriangle, Check, Pencil, Sparkles } from "lucide-react";

export default function PatientIntentConfirmation({
  proposal,
  intentLabel,
  onConfirm,
  onCorrect,
}) {
  const requiresManualChoice = proposal?.status !== "confirm";
  const hasSafetySignal = (proposal?.possible_safety_flags || []).length > 0;

  return (
    <div className="py-2 sm:py-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Interpretare asistata
      </div>

      <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {requiresManualChoice
          ? "Mai avem nevoie de o clarificare."
          : `Am inteles ca ai nevoie de ${String(intentLabel || "acest serviciu").toLowerCase()}.`}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {requiresManualChoice
          ? (proposal?.clarification_question || "Alege categoria potrivita pentru a continua cu intrebarile relevante.")
          : "Confirma interpretarea inainte sa continuam. AI-ul nu alege furnizorii si nu stabileste ordinea rezultatelor."}
      </p>

      {hasSafetySignal && (
        <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Formularea poate contine un semnal care merita evaluare rapida. VIASEE nu pune diagnostic si nu stabileste daca situatia este sau nu urgenta. Pentru simptome severe, aparute brusc sau care se agraveaza, foloseste serviciile medicale de urgenta.
          </p>
        </div>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {!requiresManualChoice && (
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Check className="h-4 w-4" />
            Da, continua
          </button>
        )}
        <button
          type="button"
          onClick={onCorrect}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <Pencil className="h-4 w-4" />
          {requiresManualChoice ? "Aleg categoria" : "Aleg alta nevoie"}
        </button>
      </div>
    </div>
  );
}
