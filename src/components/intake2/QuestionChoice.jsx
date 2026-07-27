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
      {question.options.map((option) => (
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
