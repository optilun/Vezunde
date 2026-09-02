import React, { useEffect, useMemo, useState } from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import UrgencyInterruption from "./UrgencyInterruption";
import { buildPatientSafetyAssessment } from "@/lib/patientSafety";
import { PATIENT_GUIDANCE_QUESTION_CATALOG } from "../../../shared/patientGuidanceQuestionCatalog.js";

// 2026-09-02: etichetele de triaj nu mai sunt copiate aici. Erau duplicate cuvant cu cuvant
// din SAFETY_OPTIONS, iar comentariul de deasupra doar cerea sa ramana identice - ceea ce nu
// e o garantie, ci o speranta. Text clinic in doua exemplare inseamna ca o corectie aprobata
// medical se poate aplica pe unul si nu pe celalalt. Acum vin din catalogul aprobat, singura
// sursa. "Niciuna dintre acestea" se randeaza separat, ca buton de continuare.
const SAFETY_QUESTION = PATIENT_GUIDANCE_QUESTION_CATALOG.safety_targeted_check;
const SAFETY_CHOICES = SAFETY_QUESTION.options.filter((option) => option.key !== "niciuna");
const SAFETY_NONE_LABEL = SAFETY_QUESTION.options.find((option) => option.key === "niciuna")?.label
  || "Niciuna dintre acestea";

function assessmentForChoice(answerValue) {
  return buildPatientSafetyAssessment({
    answers: [{ question_key: "safety_screening", answer_value: answerValue }],
  });
}

// Ecranul de siguranta precede intrebarea libera despre simptome. Cheia legacy este
// "descriere", cea din catalogul aprobat este "symptom_description" - le acoperim pe
// amandoua, altfel verificarea ar disparea tacut in ziua in care fluxul de simptome ar
// incepe sa foloseasca intrebarea din catalog.
const SYMPTOM_TEXT_QUESTION_KEYS = new Set(["descriere", "symptom_description"]);

export default function QuestionText({ question, onSubmit, onPhaseChange, onSafetyCleared }) {
  const [value, setValue] = useState("");
  const [screeningCleared, setScreeningCleared] = useState(!SYMPTOM_TEXT_QUESTION_KEYS.has(question.key));
  const [urgentChoice, setUrgentChoice] = useState("");
  const [textAssessment, setTextAssessment] = useState(null);
  const urgentAssessment = useMemo(
    () => (urgentChoice ? assessmentForChoice(urgentChoice) : null),
    [urgentChoice],
  );

  // Anuntam parintele cand suntem pe ecranul de siguranta (nu inca pe intrebarea reala),
  // ca sa poata ascunde titlul generic al intrebarii ('Descrie pe scurt...'), care nu are
  // legatura cu verificarea de siguranta si crea impresia de doua ecrane suprapuse.
  useEffect(() => {
    onPhaseChange?.(screeningCleared ? "answer" : "safety");
  }, [screeningCleared, onPhaseChange]);

  const submit = () => {
    const nextValue = value.trim();
    if (!nextValue) return;
    const assessment = buildPatientSafetyAssessment({ text: nextValue });
    if (assessment.blocking) {
      setTextAssessment(assessment);
      return;
    }
    onSubmit(question, nextValue);
  };

  if (urgentAssessment?.blocking || textAssessment?.blocking) {
    return (
      <div className="mt-6">
        <UrgencyInterruption
          assessment={urgentAssessment?.blocking ? urgentAssessment : textAssessment}
          onCorrect={() => {
            setUrgentChoice("");
            setTextAssessment(null);
            setScreeningCleared(false);
          }}
        />
      </div>
    );
  }

  if (!screeningCleared) {
    return (
      <div className="mt-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Verificare de siguranță</p>
          <p className="mt-1.5 font-heading text-base font-bold leading-snug tracking-tight text-foreground">
            {SAFETY_QUESTION.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {SAFETY_QUESTION.helper}
          </p>
          <div className="mt-4 grid gap-2.5">
            {SAFETY_CHOICES.map((choice) => (
              <button
                key={choice.key}
                type="button"
                onClick={() => setUrgentChoice(choice.key)}
                className="min-h-[56px] rounded-2xl border border-border bg-background px-4 py-3 text-left text-sm font-semibold leading-snug text-foreground transition-all duration-200 hover:border-foreground/40 hover:bg-secondary/50"
              >
                {choice.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                // 2026-09-01: inainte, acest buton doar deschidea ecranul urmator si nu
                // salva nimic. Consecinte in lant: starea de siguranta ramanea "neverificat"
                // pentru totdeauna, fluxul de simptome nu se putea considera niciodata
                // complet, iar furnizorul care primea cererea nu vedea ca pacientul a fost
                // intrebat. Acum raspunsul se inregistreaza ca orice alt raspuns ghidat.
                onSafetyCleared?.();
                setScreeningCleared(true);
              }}
              className="min-h-[56px] rounded-2xl bg-primary px-4 py-3 text-left text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {SAFETY_NONE_LABEL}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {question.helper && (
        <p className="-mt-2 mb-3 text-sm leading-relaxed text-muted-foreground">{question.helper}</p>
      )}
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
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
      {/* 2026-09-01: unele intrebari libere nu pot fi raspunse de toata lumea. Cine nu are
          trimiterea la el ramanea blocat: campul nu accepta raspuns gol si nu exista nicio
          iesire. Raspunsul de ocolire e un text real, nu unul gol, ca sa fie inregistrat
          ca fapt si sa nu reintre in bucla aceleiasi intrebari. */}
      {question.allow_skip && (
        <button
          type="button"
          onClick={() => onSubmit(question, question.skip_answer_text || "Nu o am la mine acum")}
          className="mt-3 min-h-11 w-full rounded-full border border-border bg-background px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {question.skip_label || "Trec mai departe"}
        </button>
      )}
    </div>
  );
}
