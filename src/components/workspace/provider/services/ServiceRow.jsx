// Faza 2: randul de serviciu (comutator) plus bifa secundara de CAS, extrase 1:1.
import React from "react";
import { Check } from "lucide-react";
import { getServiceDescription } from "../../../../../shared/serviceDescriptions.js";
import { ChangeBadge, StatusBadge } from "./ServiceBadges";
import { isSelected, serviceLabel } from "./servicesConfigModel";

export default function ServiceRow({ item, selected, approvedSelected, prerequisite, unitKey, disabled, helperText = "", onToggle, casActive = false, casEligible = false, onToggleCas, filter = "all" }) {
  const active = isSelected(selected, item);
  const approved = isSelected(approvedSelected, item);
  const removalRequested = approved && !active;
  const draftAddition = active && !approved;
  const blockerDetail = active && prerequisite?.eligible === false
    ? prerequisite.blockers?.[0]?.message
    : "";
  // Descrierea din catalog e textul implicit al randului; mesajele de stare au prioritate.
  const detail = removalRequested
    ? "La trimiterea cererii, elementul este ascuns public până la soluționare."
    : blockerDetail || helperText || getServiceDescription(item.id);
  const casVisible = active && !removalRequested && casEligible;
  // Faza 3: filtrele de verificare ("Oferta selectata", "Observatii") se aplica aici,
  // din props. Inainte invelisul scana DOM-ul si scria data-service-filter-visible.
  const blocked = active && prerequisite?.eligible === false;
  const filterVisible = filter === "all"
    || (filter === "selected" && active)
    || (filter === "issues" && blocked);
  return (
    <div
      data-service-filter-visible={filterVisible ? "true" : "false"}
      className={`services-row relative border-b border-border/50 transition last:border-b-0 ${removalRequested ? "bg-amber-50/60" : "bg-transparent"}`}
    >
    <button
      type="button"
      data-service-key={item.id}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onToggle(item, unitKey)}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-55 ${removalRequested ? "hover:bg-amber-50" : active ? "" : "hover:bg-card/60"}`}
    >
      <span className="min-w-0">
        <span className="services-row__title block text-sm font-semibold leading-snug text-foreground">{serviceLabel(item)}</span>
        {detail && <span className="services-row__detail mt-1 block text-[11px] leading-relaxed text-muted-foreground">{detail}</span>}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 empty:hidden">
          <ChangeBadge draftAddition={draftAddition} removalRequested={removalRequested} />
          {!removalRequested && <StatusBadge prerequisite={prerequisite} />}
        </span>
      </span>
      {/* Comutator pentru activarea serviciului: decizie de owner (2026-08-06). */}
      <span
        className={`relative inline-flex h-[24px] w-[42px] shrink-0 items-center rounded-full transition-colors ${removalRequested ? "bg-amber-300" : active ? "bg-foreground" : "bg-border"}`}
      >
        <span className={`absolute h-[18px] w-[18px] rounded-full bg-background shadow-sm transition-all ${active || removalRequested ? "left-[21px]" : "left-[3px]"}`} />
      </span>
    </button>
    {/* CAS ramane BIFA, deliberat diferit de comutatorul serviciului. */}
    {casVisible && (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={casActive}
        onClick={() => onToggleCas?.(item.id)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-border/40 px-4 py-3.5 pl-8 text-left transition hover:bg-card/60 disabled:cursor-not-allowed disabled:opacity-55 sm:py-2.5"
      >
        <span className="text-[11px] font-semibold text-muted-foreground">Decontat prin CAS</span>
        <span className={`flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors ${casActive ? "border-foreground bg-foreground" : "border-border bg-background"}`}>
          {casActive && <Check className="h-2.5 w-2.5 text-background" />}
        </span>
      </button>
    )}
    </div>
  );
}