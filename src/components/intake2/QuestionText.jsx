import React, { useState } from "react";
import ContinueButton from "@/components/intake/ContinueButton";

export default function QuestionText({ question, onSubmit }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-6">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={question.placeholder || ""}
        rows={3}
        autoFocus
        className="w-full bg-secondary/50 border border-border rounded-2xl px-4 py-3.5 text-base outline-none focus:border-foreground/40 transition-colors resize-none placeholder:text-[#9B968D]"
      />
      <ContinueButton onClick={() => onSubmit(question, value.trim())} disabled={!value.trim()} />
    </div>
  );
}