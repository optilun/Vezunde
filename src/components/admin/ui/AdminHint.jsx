import React from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Indiciu „ⓘ” (2026-10-07). Explicațiile lungi nu dispar, dar nu mai ocupă ecranul: apar la
// atingere/click, lângă titlu sau lângă un control. Panoul rămâne curat, informația rămâne la îndemână.
export default function AdminHint({ children, label = "Mai multe informații", className = "" }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-xs leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
