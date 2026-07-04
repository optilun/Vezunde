import React from "react";
import { Check } from "lucide-react";

export default function ToggleChip({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm transition-colors ${
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40"
      }`}
    >
      {selected && <Check className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}