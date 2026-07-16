import React, { useState } from "react";
import ContinueButton from "@/components/intake/ContinueButton";

export default function QuestionText({ question, onSubmit }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-6">
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
        onClick={() => onSubmit(question, value.trim())}
        disabled={!value.trim()}
      />
    </div>
  );
}
