// Faza 2: pasul 3 - tipul activitatii (lista derulanta, o singura alegere).
import React from "react";
import { ChevronDown } from "lucide-react";
import { CARE_SETTINGS } from "@/lib/providerLocationFunctionalUnits";
import { ChangeBadge } from "./ServiceBadges";

export default function CareSettingPicker({ options, approvedValue, value, disabled, onChange, dataAttrs = {} }) {
  const visibleOptions = options.filter((key) => CARE_SETTINGS[key]);
  if (visibleOptions.length <= 1 || visibleOptions.every((key) => key === "not_applicable" || key === "retail_only")) return null;
  const hasVisibleSelection = visibleOptions.includes(value);
  return (
    <section {...dataAttrs} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      {value !== approvedValue && <div className="mb-2 flex"><ChangeBadge modified /></div>}
      {!hasVisibleSelection && <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">Alege o opțiune pentru a continua.</div>}
      {/* Lista derulanta, nu butoane-pastila: o singura alegere dintr-un set numit. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-foreground">Varianta selectată</span>
        <div className="relative">
          <select
            value={hasVisibleSelection ? value : ""}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Tipul activității"
            className="appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-9 text-[13px] font-medium text-foreground outline-none transition focus:border-foreground/35 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {!hasVisibleSelection && <option value="" disabled>Alege o opțiune</option>}
            {visibleOptions.map((key) => (
              <option key={key} value={key}>{CARE_SETTINGS[key].label}</option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    </section>
  );
}