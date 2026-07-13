import React from "react";
import { Check } from "lucide-react";

export default function ChoiceCard({ label, hint = "", selected = false, suggested = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[72px] w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 sm:min-h-0 sm:items-center sm:gap-4 sm:p-5 ${
        selected
          ? "border-foreground bg-foreground text-background shadow-lg"
          : "border-border bg-card hover:border-foreground/40 hover:shadow-md"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 font-heading text-base font-bold leading-snug tracking-tight sm:text-lg">
          <span className="break-words">{label}</span>
          {suggested && !selected && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
              Sugestie
            </span>
          )}
        </div>
        {hint && <div className={`mt-1 text-sm leading-5 ${selected ? "text-background/70" : "text-muted-foreground"}`}>{hint}</div>}
      </div>
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border sm:mt-0 ${
          selected ? "border-background bg-background text-foreground" : "border-border"
        }`}
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </div>
    </button>
  );
}
