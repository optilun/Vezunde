import React from "react";
import { Building2, Stethoscope } from "lucide-react";

// Selectorul dintre cele doua unitati de recomandare, pentru aceeasi cerere.
//
// 2026-09-03. Nu este o pagina noua si nu reia intrebarile: acelasi context al cererii, doua
// raspunsuri la intrebari diferite - "unde ma duc" si "la cine ma duc". De aceea sta chiar
// deasupra rezultatelor, nu in meniul principal.
//
// Vizual foloseste pattern-ul de segment control deja prezent in aplicatie (fundal secondary,
// pastila activa pe card, radius plin), fara sa introduca o componenta noua de design.

export const RESULT_MODES = Object.freeze({
  locations: {
    key: "locations",
    label: "Clinici și optici",
    Icon: Building2,
  },
  professionals: {
    key: "professionals",
    label: "Specialiști",
    Icon: Stethoscope,
  },
});

export default function ResultModeTabs({ mode, onChange, counts = {} }) {
  return (
    <div
      role="tablist"
      aria-label="Tipul rezultatelor"
      className="flex w-full gap-1 rounded-full border border-border bg-secondary/60 p-1"
    >
      {Object.values(RESULT_MODES).map((entry) => {
        const active = mode === entry.key;
        const count = counts[entry.key];
        const { Icon } = entry;
        return (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(entry.key)}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${
              active
                ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            <span>{entry.label}</span>
            {Number.isFinite(Number(count)) && Number(count) > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${active ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
