// Randul unui grup de servicii in lista unei zone (drill-down, 2026-08-18): inlocuieste
// lista lunga cu toate grupurile deschise simultan. Apesi randul, intri in grup.
import React from "react";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { GROUP_TONE } from "./servicesUiTokens";
import CategorySymbol from "./CategorySymbol";

export default function SectionListRow({ section, selectedCount, onOpen }) {
  const tone = GROUP_TONE[section.group];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="services-row flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/20 sm:px-5"
    >
      {/* Simbolul VIASEE, ca la titlul din sectiunea deschisa (2026-08-18) - aceasta
          componenta era separata de UnitAccordion.jsx si avea propria bulina veche,
          neatinsa la primele incercari de reparatie. */}
      {tone && <CategorySymbol color={tone.border} className="h-5 w-5" />}
      <span className="min-w-0 flex-1">
        <span className="services-row__title block truncate text-[15px] font-bold tracking-tight">{section.title}</span>
        <span className="services-row__detail mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {selectedCount > 0 && <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-[#315c3a]" />}
          {selectedCount} din {section.items.length} selectate
        </span>
      </span>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}