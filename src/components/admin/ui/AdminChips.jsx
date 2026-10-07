import React from "react";
import { cn } from "@/lib/utils";

// Filtre rapide (2026-10-07): același aspect ca AdminTabs, dar semantic sunt butoane-comutator
// (aria-pressed), nu taburi. Folosit pentru filtrele de listă (stare, tip etc.).
//   options: [{ key, label, count? }]
export default function AdminChips({ options, value, onChange, label = "Filtre", className = "" }) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = option.key === value;
        const hasCount = Number.isFinite(option.count);
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.key)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            {option.label}
            {hasCount && (
              <span className={cn("tabular-nums", selected ? "text-background/70" : "text-muted-foreground")}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
