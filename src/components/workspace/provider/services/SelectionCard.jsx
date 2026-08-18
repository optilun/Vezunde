// Faza 2: cardul de selectie folosit pentru zone, activitati si atribute de locatie.
// variant="square" adaugat 2026-08-18, doar pentru grila de spatii (UnitPicker) - restul
// picker-elor (dotari, atribute) raman pe varianta implicita, pe randuri.
import React from "react";
import { Check, X } from "lucide-react";
import { ChangeBadge } from "./ServiceBadges";

export default function SelectionCard({ active, approved = false, title, description, helper, icon: Icon, disabled, onClick, variant = "row" }) {
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;

  if (variant === "square") {
    return (
      <button
        type="button"
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={`services-card services-card--square relative flex h-full w-full flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-60 ${removalRequested ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50" : active ? "border-foreground/15 bg-secondary/45" : "border-border bg-card hover:bg-secondary/25"}`}
      >
        <span className={`services-card__check absolute right-3 top-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${removalRequested ? "border-amber-300 bg-amber-100 text-amber-900" : active ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>
          {removalRequested ? <X className="h-3.5 w-3.5" /> : active && <Check className="h-3.5 w-3.5" />}
        </span>
        <span className={`services-card__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${removalRequested ? "bg-amber-100 text-amber-900" : active ? "bg-card text-foreground" : "bg-secondary/55 text-muted-foreground"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-snug text-foreground">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground line-clamp-2">{description}</span>
        </span>
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {helper && <span className="text-[10px] font-semibold text-muted-foreground">{helper}</span>}
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`services-card flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-60 ${removalRequested ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50" : active ? "border-foreground/15 bg-secondary/45" : "border-border bg-card hover:bg-secondary/25"}`}
    >
      <span className={`services-card__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${removalRequested ? "bg-amber-100 text-amber-900" : active ? "bg-card text-foreground" : "bg-secondary/55 text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="text-sm font-bold leading-snug text-foreground">{title}</span>
          {/* Comutator, nu bifa (2026-08-18): singurul consumator ramas al acestei
              variante e "La nivelul locatiei" - atribute care se comporta identic cu
              serviciile (selectie confirmata prin salvare), deci acelasi control ca
              acolo, pentru consecventa. Bifa patrata ramane doar la varianta "square". */}
          <span className={`relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full transition-colors ${removalRequested ? "bg-amber-300" : active ? "bg-foreground" : "bg-border"}`}>
            <span className={`absolute h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-all ${active || removalRequested ? "left-[18px]" : "left-[3px]"}`} />
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