// Faza 2: pasul 1 - spatiile existente in locatie.
import React from "react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import SelectionCard from "./SelectionCard";
import { UNIT_FALLBACK_ICON, UNIT_ICONS } from "./servicesUiTokens";

// Doua grupuri vizuale, cerute explicit (2026-08-18): optica (vanzare, tehnic) separata
// de oftalmologie/medical (evaluare, diagnostic). Cabinet optometric intra la medical -
// masoara si evalueaza vederea, nu vinde sau repara; e o alegere de judecata, nu regula
// tehnica - usor de mutat daca Alex vede altfel.
const OPTICAL_UNIT_KEYS = new Set(["optical_store", "optical_cabinet", "optical_workshop", "optical_laboratory", "b2b_distribution_center"]);
const MEDICAL_UNIT_KEYS = new Set(["optometry_cabinet", "ophthalmology_office", "ophthalmology_diagnostics", "ophthalmology_procedure_room", "ophthalmology_surgery_unit"]);

function UnitGroup({ label, unitKeys, approvedUnits, activeUnits, selectedByUnit, primaryUnits, disabled, onToggle }) {
  if (unitKeys.length === 0) return null;
  return (
    <div>
      <p className="services-unit-group-label mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="services-card-grid services-card-grid--square grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {unitKeys.map((unitKey) => {
          const definition = getFunctionalUnitDefinition(unitKey);
          const Icon = UNIT_ICONS[unitKey] || UNIT_FALLBACK_ICON;
          const active = activeUnits.includes(unitKey);
          const count = selectedByUnit[unitKey] || 0;
          return (
            <SelectionCard
              key={unitKey}
              variant="square"
              active={active}
              approved={approvedUnits.includes(unitKey)}
              title={definition?.title || unitKey}
              description={definition?.description || ""}
              helper={count > 0 ? `${count} opțiuni asociate` : primaryUnits.includes(unitKey) ? "Recomandat pentru acest profil" : "Opțional"}
              icon={Icon}
              disabled={disabled}
              onClick={() => onToggle(unitKey)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function UnitPicker({ units, approvedUnits, activeUnits, selectedByUnit, primaryUnits, disabled, onToggle, dataAttrs = {} }) {
  const [showOptional, setShowOptional] = useState(false);
  const hiddenUnits = units.filter((unitKey) => !primaryUnits.includes(unitKey) && !activeUnits.includes(unitKey) && !approvedUnits.includes(unitKey));
  const visibleUnits = showOptional
    ? units
    : units.filter((unitKey) => primaryUnits.includes(unitKey) || activeUnits.includes(unitKey) || approvedUnits.includes(unitKey));
  const opticalUnits = visibleUnits.filter((key) => OPTICAL_UNIT_KEYS.has(key));
  const medicalUnits = visibleUnits.filter((key) => MEDICAL_UNIT_KEYS.has(key));
  const otherUnits = visibleUnits.filter((key) => !OPTICAL_UNIT_KEYS.has(key) && !MEDICAL_UNIT_KEYS.has(key));

  return (
    <section {...dataAttrs} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      {/* Titlul si contextul stau in antetul ecranului. Aici era acelasi titlu, numerotat,
          plus o descriere care repeta antetul - trei straturi de text pentru o singura lista.
          Carduri patrate, in grila, grupate optica/medical (2026-08-18) - inainte, un singur
          rand lung pe latime, fara distinctie intre tipurile de spatii. */}
      <div className="space-y-5">
        <UnitGroup label="Optică" unitKeys={opticalUnits} approvedUnits={approvedUnits} activeUnits={activeUnits} selectedByUnit={selectedByUnit} primaryUnits={primaryUnits} disabled={disabled} onToggle={onToggle} />
        <UnitGroup label="Oftalmologie și evaluare medicală" unitKeys={medicalUnits} approvedUnits={approvedUnits} activeUnits={activeUnits} selectedByUnit={selectedByUnit} primaryUnits={primaryUnits} disabled={disabled} onToggle={onToggle} />
        <UnitGroup label="Alte spații" unitKeys={otherUnits} approvedUnits={approvedUnits} activeUnits={activeUnits} selectedByUnit={selectedByUnit} primaryUnits={primaryUnits} disabled={disabled} onToggle={onToggle} />
      </div>
      {hiddenUnits.length > 0 && (
        <button type="button" onClick={() => setShowOptional((value) => !value)} className="services-more-toggle mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary">
          <ChevronDown className={`h-3.5 w-3.5 transition ${showOptional ? "rotate-180" : ""}`} />
          {showOptional ? "Ascunde spațiile opționale" : `Arată alte spații disponibile (${hiddenUnits.length})`}
        </button>
      )}
    </section>
  );
}