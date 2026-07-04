import React from "react";
import { Check } from "lucide-react";

export default function ChoiceCard({ label, hint, selected, suggested, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-5 transition-all duration-200 flex items-center gap-4 ${
        selected
          ? "border-foreground bg-foreground text-background shadow-lg"
          : "border-border bg-card hover:border-foreground/40 hover:shadow-md"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-heading font-bold text-base sm:text-lg tracking-tight flex items-center gap-2">
          <span>{label}</span>
          {suggested && !selected && (
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-secondary text-foreground/70 rounded-full px-2 py-0.5">
              Sugestie
            </span>
          )}
        </div>
        {hint && <div className={`mt-1 text-sm ${selected ? "text-background/60" : "text-muted-foreground"}`}>{hint}</div>}
      </div>
      <div
        className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
          selected ? "border-background bg-background text-foreground" : "border-border"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </div>
    </button>
  );
}