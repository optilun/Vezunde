// Faza 2: pasul 4 - opțiunile valabile la nivelul locatiei.
import React from "react";
import SelectionCard from "./SelectionCard";
import { isSelected, serviceLabel } from "./servicesConfigModel";
import { BUSINESS_ATTRIBUTE_ICONS, UNIT_FALLBACK_ICON } from "./servicesUiTokens";

const HELPER_TEXT = {
  home_visit_eye_care: "Te deplasezi la domiciliul pacientului, pentru persoane care nu pot ajunge la locație.",
  workplace_vision_screening: "Testezi vederea angajaților la sediul companiei, inclusiv pentru medicina muncii.",
  employer_glasses_reimbursement: "Emiți documentele de care are nevoie angajatorul ca să deconteze ochelarii (HG 1028/2006).",
  mobile_optical_unit: "Ai o unitate mobilă dotată, care se deplasează la client.",
  school_vision_screening: "Faci screening de vedere în școli și grădinițe.",
};

export default function GlobalServiceSections({ sections, selected, approvedSelected, disabled, onToggleService, dataAttrs = {} }) {
  if (sections.length === 0) return null;
  return (
    <section {...dataAttrs} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Carduri mari: sunt atribute despre cum functioneaza afacerea, nu produse.
          Titlul si contextul vin din antetul ecranului. */}
      <div className="services-card-grid space-y-2 p-4 sm:p-5">
        {sections.flatMap((section) => section.items).map((item) => {
          const Icon = BUSINESS_ATTRIBUTE_ICONS[item.id] || UNIT_FALLBACK_ICON;
          return (
            <SelectionCard
              key={`${item.group}:${item.id}`}
              active={isSelected(selected, item)}
              approved={isSelected(approvedSelected, item)}
              title={serviceLabel(item)}
              description={HELPER_TEXT[item.id] || ""}
              icon={Icon}
              disabled={disabled}
              onClick={() => onToggleService(item, "")}
            />
          );
        })}
      </div>
    </section>
  );
}