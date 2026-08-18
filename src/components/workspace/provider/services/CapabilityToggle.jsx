// Faza 2b: comutator inline pentru o capabilitate (2026-08-18). Inlocuieste modulul
// separat "Dotari si activitati" - fiecare capabilitate se muta langa sectiunea (sau
// zona) pe care o deschide, in loc de o lista de bifat inainte de a vedea contextul.
import React from "react";
import { getCapabilityDefinition } from "@/lib/providerLocationFunctionalUnits";

export default function CapabilityToggle({ capabilityKey, activeRow, approved, disabled, onToggle, compact = false }) {
  const definition = getCapabilityDefinition(capabilityKey);
  if (!definition) return null;
  const active = Boolean(activeRow);
  const removalRequested = approved && !active;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onToggle}
      className={`services-capability-toggle grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border px-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15 disabled:cursor-not-allowed disabled:opacity-55 ${compact ? "py-2.5" : "py-3"} ${removalRequested ? "border-amber-200 bg-amber-50/70 hover:bg-amber-50" : active ? "border-foreground/25 bg-secondary/35" : "border-border bg-card hover:bg-secondary/20"}`}
    >
      <span className="min-w-0">
        <span className={`block font-semibold leading-snug text-foreground ${compact ? "text-[13px]" : "text-sm"}`}>{definition.title}</span>
        {!compact && definition.description && <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{definition.description}</span>}
        {removalRequested && <span className="mt-0.5 block text-[10px] font-semibold text-amber-800">Se elimină la trimiterea cererii</span>}
      </span>
      <span className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors ${removalRequested ? "bg-amber-300" : active ? "bg-foreground" : "bg-border"}`}>
        <span className={`absolute h-[16px] w-[16px] rounded-full bg-background shadow-sm transition-all ${active || removalRequested ? "left-[19px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}
