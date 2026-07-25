import React, { useMemo, useState } from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import UrgencyInterruption from "./UrgencyInterruption";
import { buildPatientSafetyAssessment } from "@/lib/patientSafety";

const SAFETY_CHOICES = [
  { key: "pierdere_brusca_vedere", label: "Nu mai vad brusc sau vederea a scazut mult" },
  { key: "substanta_chimica", label: "A ajuns o substanta chimica in ochi" },
  { key: "traumatism_obiect", label: "Un obiect a patruns in ochi sau a existat o lovitura puternica" },
  { key: "durere_severa", label: "Am durere oculara foarte mare, mai ales cu vedere modificata, greata sau cefalee" },
  { key: "fulgerari_perdea_diplopie", label: "Au aparut brusc fulgerari, multe puncte, o umbra/perdea sau vedere dubla" },
  { key: "postoperator_acut", label: "Am durere, roseata sau modificarea vederii dupa operatie ori injectie oculara recenta" },
];

function assessmentForChoice(answerValue) {
  return buildPatientSafetyAssessment({
    answers: [{ question_key: "safety_screening", answer_value: answerValue }],
  });
}

export default function QuestionText({ question, onSubmit }) {
  const [value, setValue] = useState("");
  const [screeningCleared, setScreeningCleared] = useState(question.key !== "descriere");
  const [urgentChoice, setUrgentChoice] = useState("");
  const [textAssessment, setTextAssessment] = useState(null);
  const [safetyReviewedValue, setSafetyReviewedValue] = useState("");
  const urgentAssessment = useMemo(
    () => (urgentChoice ? assessmentForChoice(urgentChoice) : null),
    [urgentChoice],
  );
  const blockingAssessment = urgentAssessment?.blocking
    ? urgentAssessment
    : (textAssessment?.blocking ? textAssessment : null);

  const submit = () => {
    const nextValue = value.trim();
    if (!nextValue) return;
    const assessment = buildPatientSafetyAssessment({ text: nextValue });
    if (assessment.blocking) {
      setTextAssessment(assessment);
      return;
    }
    if (assessment.advisory && safetyReviewedValue !== nextValue) {
      setTextAssessment(assessment);
      setScreeningCleared(false);
      return;
    }
    onSubmit(question, nextValue);
  };

  if (blockingAssessment) {
    return (
      <div className="mt-6">
        <UrgencyInterruption
          assessment={blockingAssessment}
          mode="blocking"
          onCorrect={() => {
            if (urgentAssessment?.blocking) {
              setUrgentChoice("");
              return;
            }
            setTextAssessment(null);
            setSafetyReviewedValue("");
            setScreeningCleared(false);
          }}
        />
      </div>
    );
  }

  if (!screeningCleared) {
    return (
      <div className="mt-6 space-y-4">
        {textAssessment?.advisory && (
          <UrgencyInterruption
            assessment={textAssessment}
            mode="advisory"
            onCorrect={() => {
              setUrgentChoice("");
              setTextAssessment(null);
              setSafetyReviewedValue("");
              setScreeningCleared(true);
            }}
          />
        )}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-amber-800">Verificare de siguranta</p>
          <p className="mt-1 text-sm font-bold">
            {textAssessment?.advisory
              ? "Ca sa diferentiem o problema obisnuita de una urgenta, se aplica acum una dintre situatiile de mai jos?"
              : "Se aplica acum una dintre situatiile de mai jos?"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-900/80">Selecteaza situatia exacta. VIASEE nu stabileste diagnosticul, dar nu continua cautarea obisnuita cand exista un semnal clar de urgenta.</p>
          <div className="mt-4 grid gap-2">
            {SAFETY_CHOICES.map((choice) => (
              <button
                key={choice.key}
                type="button"
                onClick={() => setUrgentChoice(choice.key)}
                className="min-h-11 rounded-xl border border-amber-200 bg-white px-4 py-3 text-left text-xs font-semibold leading-relaxed text-foreground transition-colors hover:border-amber-400 hover:bg-amber-100/50"
              >
                {choice.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setUrgentChoice("");
                if (textAssessment?.advisory) {
                  const reviewedValue = value.trim();
                  const reviewedAssessment = buildPatientSafetyAssessment({
                    text: reviewedValue,
                    answers: [{ question_key: "safety_screening", answer_value: "niciuna" }],
                  });
                  if (!reviewedAssessment.clear) {
                    setTextAssessment(reviewedAssessment);
                    setScreeningCleared(false);
                    return;
                  }
                  setSafetyReviewedValue(reviewedValue);
                  setTextAssessment(null);
                  setScreeningCleared(true);
                  if (reviewedValue) {
                    onSubmit(question, reviewedValue);
                  }
                  return;
                }
                setScreeningCleared(true);
              }}
              className="min-h-11 rounded-xl bg-foreground px-4 py-3 text-left text-xs font-bold text-background transition-opacity hover:opacity-90"
            >
              Niciuna dintre acestea
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <textarea
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (event.target.value.trim() !== safetyReviewedValue) {
            setSafetyReviewedValue("");
          }
        }}
        placeholder={question.placeholder || ""}
        aria-label={question.title || "Răspunsul tău"}
        rows={3}
        autoFocus
        className="w-full resize-none rounded-2xl border border-border bg-secondary/50 px-4 py-3.5 text-base outline-none transition-colors placeholder:text-[#9B968D] focus:border-foreground/40"
      />
      <ContinueButton
        onClick={submit}
        disabled={!value.trim()}
      />
    </div>
  );
}
