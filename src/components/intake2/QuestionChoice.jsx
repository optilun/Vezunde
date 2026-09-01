import React, { useState } from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { buildPatientSafetyAssessment } from "@/lib/patientSafety";
import UrgencyInterruption from "./UrgencyInterruption";

export default function QuestionChoice({ question, onSelect }) {
  const [urgentAssessment, setUrgentAssessment] = useState(null);

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
      {/* Optiunile marcate `hidden` raman valori valide (cereri salvate, raspunsuri LLM,
          punctare), dar nu se mai ofera pacientului. */}
      {question.options.filter((option) => !option.hidden).map((option) => (
        <ChoiceCard
          key={option.key}
          label={option.label}
          hint={option.hint}
          onClick={() => handleSelect(option)}
        />
      ))}
    </div>
  );
}
