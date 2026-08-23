// Faza 2: pasul 3 - tipul activitatii (lista derulanta, o singura alegere).
import React from "react";
import { ChevronDown } from "lucide-react";
import { CARE_SETTINGS } from "@/lib/providerLocationFunctionalUnits";
import { ChangeBadge } from "./ServiceBadges";

// 2026-08-23: `embedded` il face primul rand al panoului "La nivelul locatiei" in loc de
// card de sine statator - tipul activitatii e un atribut al locatiei, ca si cele de sub
// el, iar doua chenare pentru acelasi ecran lasau un gol vizual la mijloc.
export default function CareSettingPicker({ options, approvedValue, value, disabled, onChange, embedded = false, dataAttrs = {} }) {
  const visibleOptions = options.filter((key) => CARE_SETTINGS[key]);
  if (visibleOptions.length <= 1 || visibleOptions.every((key) => key === "not_applicable" || key === "retail_only")) return null;
  const hasVisibleSelection = visibleOptions.includes(value);
  return (
    <section {...dataAttrs} className={`services-care-setting ${embedded ? "border-b border-border/70 p-4 sm:px-5" : "rounded-2xl border border-border bg-card p-4 shadow-sm"}`}>
      {value !== approvedValue && <div className="mb-2 flex"><ChangeBadge modified /></div>}
      {!hasVisibleSelection && <div className="mb-3 rounded-2xl border border-[#e1bda8] bg-[#efd5c5] px-3 py-2.5 text-xs text-black/70">Alege o opțiune pentru a continua.</div>}
      {/* Titlu + descriere in stanga, select in dreapta, PE ACELASI RAND (2026-08-18) -
          inainte erau doua randuri stivuite (titlu deasupra, select dedesubt, impins la
          justify-end), ceea ce lasa un gol vizual intre text si control. Acum e un
          singur rand flex, exact ca la cardurile de mai jos (text stanga, control
          dreapta, aliniate pe centru vertical). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-sm font-semibold leading-snug text-foreground">Tipul activității</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">Descrie activitatea locației, fără să schimbe tipul organizației.</span>
        </div>
        <div className="relative shrink-0">
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