// Figurine desenate pentru "La nivelul locatiei" (2026-08-23), la cererea lui Alex:
// "fa si aici emoticoane cum ai facut la spatii existente".
//
// Cadrul, paleta si scara vin din UnitFigures.jsx, nu sunt copiate: acelasi cerc punctat,
// aceeasi liniuta, acelasi grup scalat. Daca vreodata se ajusteaza scara acolo, se ajusteaza
// si aici, fara sa ramana un set in urma.
//
// Tonul e albastrul din CategoryShowcase (#dce5e9 / #c6d3da), deja folosit de ecran prin
// GROUP_TONE.optometry. Nu e o culoare noua si nu e tonul niciunei zone: cele cinci atribute
// nu SUNT o zona - sunt lucruri care se intampla in afara locatiei, la domiciliu, la sediul
// firmei, in scoli, cu unitatea mobila. Ca sa nu para a saptea zona, poarta un ton al lor.
import React from "react";
import { Figure, LIGHT_FILL, figurePalette } from "./UnitFigures";

// Consultatii la domiciliul pacientului: o casa, cu acoperisul in tonul categoriei.
function HouseFigure({ className, tone, removal }) {
  const p = figurePalette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M4.6 9.8h14.8v9.6a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4Z" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M12 3.5 21 10.2H3Z" fill={p.bg} stroke={p.border} />
      <path d="M9.9 20.8v-4.4a2.1 2.1 0 0 1 4.2 0v4.4Z" fill={p.border} stroke="none" />
    </Figure>
  );
}

// Screening la sediul companiei: o servieta, nu o cladire - cladirea generica e deja
// figurina de rezerva a zonelor si cele doua s-ar fi batut cap in cap.
function BriefcaseFigure({ className, tone, removal }) {
  const p = figurePalette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M9 8V6.4a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 6.4V8" fill="none" stroke={p.border} />
      <rect x="3.4" y="8" width="17.2" height="12.4" rx="1.7" fill={LIGHT_FILL} stroke={p.border} />
      <rect x="3.4" y="12.2" width="17.2" height="2.8" fill={p.bg} stroke={p.border} />
    </Figure>
  );
}

// Documente pentru decontarea ochelarilor (HG 1028): o foaie cu coltul indoit si stampila.
function DocumentFigure({ className, tone, removal }) {
  const p = figurePalette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M6.4 3.8h7.4l4 4v12.4H6.4Z" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M13.8 3.8v4h4" fill="none" stroke={p.border} />
      <path d="M9 12.4h6M9 15.4h4.2" stroke={p.border} />
      <circle cx="16" cy="17.2" r="2.6" fill={p.bg} stroke={p.border} />
    </Figure>
  );
}

// Unitate optica mobila: o duba vazuta din lateral.
function VanFigure({ className, tone, removal }) {
  const p = figurePalette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M2.6 8.4h10.4v8.4H2.6Z" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M13 11.2h3.6l3.8 3.8v1.8H13Z" fill={p.bg} stroke={p.border} />
      <circle cx="7" cy="18.2" r="2" fill={p.border} stroke="none" />
      <circle cx="16.6" cy="18.2" r="2" fill={p.border} stroke="none" />
    </Figure>
  );
}

// Screening in scoli si gradinite: toca de absolvire.
function SchoolFigure({ className, tone, removal }) {
  const p = figurePalette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M6.6 11.4v3.9c0 1.9 2.4 3.4 5.4 3.4s5.4-1.5 5.4-3.4v-3.9" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M12 4.4 21.2 8.6 12 12.8 2.8 8.6Z" fill={p.bg} stroke={p.border} />
      <path d="M21.2 8.6v4.8" stroke={p.border} />
    </Figure>
  );
}

export const GLOBAL_FIGURES = {
  home_visit_eye_care: HouseFigure,
  workplace_vision_screening: BriefcaseFigure,
  employer_glasses_reimbursement: DocumentFigure,
  mobile_optical_unit: VanFigure,
  school_vision_screening: SchoolFigure,
};

export const GLOBAL_FIGURE_FALLBACK = DocumentFigure;
