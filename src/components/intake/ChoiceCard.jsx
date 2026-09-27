import React from "react";
import { Check } from "lucide-react";

// 2026-09-27, cererea owner-ului: toate variantele din chestionar folosesc acest card. Varianta
// `compact` pastreaza acelasi aspect, mai scund, pentru listele lungi (localitati, anamneza).
// `pressed` se trimite doar la alegerile multiple, unde cardul ramane bifat pe ecran.
export default function ChoiceCard({ label, hint = "", selected = false, suggested = false, compact = false, pressed, onClick }) {
  const sizing = compact
    ? "min-h-[52px] items-center gap-3 p-3 sm:p-3.5"
    : "min-h-[72px] items-start gap-3 p-4 sm:min-h-0 sm:items-center sm:gap-4 sm:p-5";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex w-full rounded-2xl border text-left transition-all duration-200 ${sizing} ${
        selected
          ? "border-foreground bg-foreground text-background shadow-lg"
          : "border-border bg-card hover:border-foreground/40 hover:shadow-md"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className={`flex flex-wrap items-center gap-2 font-heading font-bold leading-snug tracking-tight ${compact ? "text-sm sm:text-[15px]" : "text-base sm:text-lg"}`}>
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
        className={`flex shrink-0 items-center justify-center rounded-full border ${compact ? "h-5 w-5" : "mt-0.5 h-6 w-6 sm:mt-0"} ${
          selected ? "border-background bg-background text-foreground" : "border-border"
        }`}
      >
        {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </div>
    </button>
  );
}
