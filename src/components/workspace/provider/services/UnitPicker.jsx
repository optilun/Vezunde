// Faza 2: pasul 1 - spatiile existente in locatie.
import React from "react";
import { getFunctionalUnitDefinition } from "@/lib/providerLocationFunctionalUnits";
import SelectionCard from "./SelectionCard";
import { UNIT_TONE } from "./servicesUiTokens";
// Figurine desenate, doar pe acest ecran (2026-08-23, la cererea lui Alex) - vezi
// comentariul din UnitFigures.jsx. UNIT_ICONS (Lucide) din servicesUiTokens.js ramane
// neatins si e folosit in continuare in sidebar si in antetul cardului de grup.
import { UNIT_FIGURE_FALLBACK, UNIT_FIGURES } from "./UnitFigures";

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
      {/* Aceeasi eticheta ca in Prezentare generala (componenta Eyebrow): mono, 10px,
          tracking larg. Inainte era uppercase obisnuit, deci alt limbaj vizual pentru
          exact acelasi rol. */}
      <p className="services-unit-group-label mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">{label}</p>
      <div className="services-card-grid services-card-grid--square grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {unitKeys.map((unitKey) => {
          const definition = getFunctionalUnitDefinition(unitKey);
          const Icon = UNIT_FIGURES[unitKey] || UNIT_FIGURE_FALLBACK;
          const active = activeUnits.includes(unitKey);
          const approved = approvedUnits.includes(unitKey);
          const count = selectedByUnit[unitKey] || 0;
          return (
            /* "Recomandat"/"Optional" e sfat pentru o alegere NEFACUTA inca, deci dispare
               in clipa in care zona e bifata sau face deja parte din profil (2026-08-23,
               semnalat de Alex). Pana acum ramanea afisat si peste el cadea marcajul de
               stare ("Nou in draft", "Eliminare propusa"): pastila de recomandare e
               pozitionata absolut in coltul din stanga-jos, exact unde curge randul de
               subsol, asa ca cele doua se suprapuneau literal, cuvant peste cuvant.
               Cu conditia de mai jos cele doua nu mai pot coexista: pastila apare doar
               cand zona nu e nici activa, nici aprobata, iar marcajul de stare apare doar
               cand e una din ele. */
            <SelectionCard
              key={unitKey}
              variant="square"
              active={active}
              approved={approved}
              title={definition?.title || unitKey}
              description={definition?.description || ""}
              helper={count > 0 ? `${count} opțiuni asociate` : ""}
              badge={active || approved || count > 0 ? "" : primaryUnits.includes(unitKey) ? "Recomandat" : "Opțional"}
              icon={Icon}
              tone={UNIT_TONE[unitKey] || null}
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
  // Toate spatiile raman vizibile permanent (2026-08-18, la cererea lui Alex) - fara
  // comutator "Arata alte spatii" care ascundea unele carduri implicit.
  const opticalUnits = units.filter((key) => OPTICAL_UNIT_KEYS.has(key));
  const medicalUnits = units.filter((key) => MEDICAL_UNIT_KEYS.has(key));
  const otherUnits = units.filter((key) => !OPTICAL_UNIT_KEYS.has(key) && !MEDICAL_UNIT_KEYS.has(key));

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
    </section>
  );
}