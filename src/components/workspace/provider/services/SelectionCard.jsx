// Faza 2: cardul de selectie folosit pentru zone, activitati si atribute de locatie.
import React from "react";
import { Check, X } from "lucide-react";
import { ChangeBadge } from "./ServiceBadges";

export default function SelectionCard({ active, approved = false, title, description, helper, icon: Icon, disabled, onClick }) {
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-60 ${removalRequested ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50" : active ? "border-foreground/15 bg-secondary/45" : "border-border bg-card hover:bg-secondary/25"}`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${removalRequested ? "bg-amber-100 text-amber-900" : active ? "bg-card text-foreground" : "bg-secondary/55 text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-sm font-bold leading-snug text-foreground">{title}</span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${removalRequested ? "border-amber-300 bg-amber-100 text-amber-900" : active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
            {removalRequested ? <X className="h-3.5 w-3.5" /> : active && <Check className="h-3.5 w-3.5" />}
          </span>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
        <span className="mt-2 flex flex-wrap items-center gap-2">
          {helper && <span className="text-[10px] font-semibold text-muted-foreground">{helper}</span>}
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
        </span>
      </span>
    </button>
  );
}