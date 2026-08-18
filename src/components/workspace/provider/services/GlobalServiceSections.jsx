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

export default function GlobalServiceSections({ sections, selected, approvedSelected, disabled, onToggleService }) {
  if (sections.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-secondary/10 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-bold">4. La nivelul locației</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Aceste opțiuni se aplică întregii locații, nu unei singure zone. Nu cerem documente - informațiile sunt declarate de furnizor.</p>
      </div>
      {/* Carduri mari: sunt atribute despre cum functioneaza afacerea, nu produse. */}
      <div className="space-y-2 p-4 sm:p-5">
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