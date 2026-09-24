import React, { useState } from "react";
import { ArrowLeft, ClipboardList } from "lucide-react";
import {
  patientAnamnesisQuestions,
  toggleAnamnesisSelection,
} from "@/lib/patientAnamnesis";

// 2026-09-24: scurta anamneza pentru cererile de consult (vezi src/lib/patientAnamnesis.js).
// Un singur ecran, toate intrebarile optionale. Nimic de aici nu schimba potrivirea sau ordinea
// rezultatelor si nimic nu ajunge automat la furnizori.
export default function PatientAnamnesis({ variant = "adult", initialSelections = {}, onSubmit, onSkip, onBack }) {
  const questions = patientAnamnesisQuestions(variant);
  const [selections, setSelections] = useState(() => ({ ...initialSelections }));
  // Ce a pornit bifat din mesajul pacientului, afisat ca sa nu para o alegere facuta de noi.
  const prefilledLabels = questions.flatMap((question) => (initialSelections[question.key] || [])
    .map((key) => question.options.find((option) => option.key === key)?.label)
    .filter(Boolean));
  const answeredCount = questions.filter((question) => (selections[question.key] || []).length > 0).length;

  const toggle = (question, optionKey) => {
    setSelections((current) => ({
      ...current,
      [question.key]: toggleAnamnesisSelection(question, current[question.key], optionKey),
    }));
  };

  return (
    <div className="py-1 sm:py-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Înapoi
        </button>
      )}
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
        <ClipboardList className="h-3.5 w-3.5" />
        Scurtă anamneză · opțional
      </div>

      <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Câteva informații pentru consult
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {variant === "child"
          ? "Ajută medicul să se pregătească pentru consultul copilului. Durează sub un minut și poți sări peste orice întrebare."
          : "Ajută medicul să se pregătească pentru consult. Durează sub un minut și poți sări peste orice întrebare."}
      </p>

      {prefilledLabels.length > 0 && (
        <p className="mt-3 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs leading-relaxed text-foreground/80">
          Am bifat din mesajul tău: {prefilledLabels.join(", ")}. Poți debifa oricând.
        </p>
      )}

      <div className="mt-6 space-y-5">
        {questions.map((question) => {
          const selected = selections[question.key] || [];
          return (
            <fieldset key={question.key}>
              <legend className="text-sm font-semibold text-foreground">{question.title}</legend>
              {question.type === "multi" && (
                <p className="mt-0.5 text-xs text-muted-foreground">Poți alege mai multe.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {question.options.map((option) => {
                  const isSelected = selected.includes(option.key);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(question, option.key)}
                      className={`min-h-11 rounded-full border px-4 py-2 text-left text-sm font-medium transition-colors ${
                        isSelected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-foreground hover:border-foreground/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        Răspunsurile rămân în cererea ta și nu schimbă ordinea rezultatelor. La final le poți trimite medicului, în mesajul pe care îl vezi și îl poți modifica înainte de trimitere.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => onSubmit?.(selections)}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {answeredCount > 0 ? "Continuă" : "Continuă fără răspunsuri"}
        </button>
        <button
          type="button"
          onClick={() => onSkip?.()}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          Sari peste
        </button>
      </div>
    </div>
  );
}
