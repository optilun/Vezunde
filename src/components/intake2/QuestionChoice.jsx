import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";

export default function QuestionChoice({ question, onSelect }) {
  return (
    <div className="mt-6 grid gap-2.5">
      {question.options.map((option) => (
        <ChoiceCard
          key={option.key}
          label={option.label}
          hint={option.hint}
          onClick={() => onSelect(question, option)}
        />
      ))}
    </div>
  );
}