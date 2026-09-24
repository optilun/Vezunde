import React, { useState } from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { buildPatientSafetyAssessment } from "@/lib/patientSafety";
import UrgencyInterruption from "./UrgencyInterruption";

export default function QuestionChoice({ question, onSelect, suggestedOptionKey = null }) {
  const [urgentAssessment, setUrgentAssessment] = useState(null);

  // 2026-09-24: varianta care corespunde mesajului pacientului este doar marcata ("Sugestie"),
  // nu preselectata. Raspunsul ramane alegerea pacientului. Intrebarea de siguranta nu primeste
  // niciodata sugestie, indiferent ce trimite parintele.
  const suggestion = question.key === "safety_targeted_check" ? null : suggestedOptionKey;
  const hasSuggestion = Boolean(suggestion)
    && question.options.some((option) => option.key === suggestion && !option.hidden);

  const handleSelect = (option) => {
    if (question.key === "safety_targeted_check" && option.key !== "niciuna") {
      const assessment = buildPatientSafetyAssessment({
        answers: [{ question_key: question.key, answer_value: option.key }],
      });
      if (assessment.blocking) {
        setUrgentAssessment(assessment);
        return;
      }
    }
    onSelect(question, option);
  };

  if (urgentAssessment?.blocking) {
    return (
      <div className="mt-6">
        <UrgencyInterruption
          assessment={urgentAssessment}
          onCorrect={() => setUrgentAssessment(null)}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-2.5">
      {/* 2026-09-01: catalogul are un camp `helper` pentru fiecare intrebare, scris cu
          grija, pe care interfata nu-l randa niciodata - inclusiv explicatia care
          impiedica un miop cronic sa declanseze o alerta de urgenta. */}
      {question.helper && (
        <p className="-mt-1 mb-1.5 text-sm leading-relaxed text-muted-foreground">
          {question.helper}
        </p>
      )}
      {hasSuggestion && (
        <p className="-mt-1 mb-1.5 text-xs leading-relaxed text-muted-foreground">
          Am marcat varianta care pare să corespundă mesajului tău. Alege-o pe cea corectă.
        </p>
      )}
      {/* Optiunile marcate `hidden` raman valori valide (cereri salvate, raspunsuri LLM,
          punctare), dar nu se mai ofera pacientului. */}
      {question.options.filter((option) => !option.hidden).map((option) => (
        <ChoiceCard
          key={option.key}
          label={option.label}
          hint={option.hint}
          suggested={hasSuggestion && option.key === suggestion}
          onClick={() => handleSelect(option)}
        />
      ))}
    </div>
  );
}
