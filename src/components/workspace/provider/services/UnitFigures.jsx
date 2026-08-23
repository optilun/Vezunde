// Figurine desenate pentru cardurile "Spatiile existente" (2026-08-23), la cererea lui
// Alex: "cardurile sa facem cu emoticoane mai speciale cum ai mai facut". Acelasi
// principiu ca ServicesFigures.jsx (desenate din forme simple, fara imagini externe,
// fara emoji) dar la scara placutei de 40x40 din SelectionCard, nu la scara mare a unei
// ilustratii de ecran gol - deci fiecare figurina are doar 2-3 forme, nu compozitia
// intreaga cu cerc punctat.
//
// Domeniu deliberat restrans (2026-08-23, decizie explicita a lui Alex): figurinele de
// aici inlocuiesc iconitele Lucide DOAR pe acest ecran (UnitPicker.jsx). Randul din
// coloana din stanga ("Oferta pe zone") si antetul cardului de grup dintr-o zona
// (UnitAccordion.jsx) raman pe UNIT_ICONS din servicesUiTokens.js, neatinse - nu e o
// scapare, e scopul cerut.
//
// Fiecare componenta accepta `className` si deseneaza cu currentColor, exact ca o
// iconita Lucide - inlocuire directa in SelectionCard, care le randeaza deja cu
// `<Icon className="h-4 w-4" />`. Placuta din jur (tonul de categorie) ramane
// neschimbata; doar desenul dinauntru e nou.
import React from "react";

const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

// Magazin optic / showroom: fatada cu copertina.
function StoreFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <path d="M4.5 9.7 6.6 5h10.8l2.1 4.7" />
      <rect x="5" y="9.7" width="14" height="9.8" rx="1.3" />
      <rect x="10.3" y="14.2" width="3.4" height="5.3" rx="0.7" />
    </svg>
  );
}

// Cabinet de optica: ochelari, desenati mai rotunjiti decat iconita generica.
function GlassesFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <rect x="3.3" y="9" width="7.2" height="6.4" rx="2.3" />
      <rect x="13.5" y="9" width="7.2" height="6.4" rx="2.3" />
      <path d="M10.5 11.4h3M1.7 10.6l1.6.5M22.3 10.6l-1.6.5" />
    </svg>
  );
}

// Cabinet optometric: un ochi, cu privirea trasa migdalat, nu geometric.
function EyeFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <path d="M2.3 12c2.6-4.3 6.1-6.6 9.7-6.6s7.1 2.3 9.7 6.6c-2.6 4.3-6.1 6.6-9.7 6.6S4.9 16.3 2.3 12Z" />
      <circle cx="12" cy="12" r="2.7" />
      <circle cx="12.9" cy="11.1" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Cabinet oftalmologic: crucea medicala, intr-un cerc - vecina, dar distincta de ochi.
function MedicalCrossFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 8.4v7.2M8.4 12h7.2" />
    </svg>
  );
}

// Atelier optic si montaj: o cheie fixa, cu un singur contur.
function WrenchFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <path d="M18.4 6.4a3.6 3.6 0 0 1-4.7 4.7L6.9 17.9l-2-2 6.8-6.8a3.6 3.6 0 0 1 4.7-4.7l-2.3 2.3 1.6 1.6 2.3-2.3Z" />
    </svg>
  );
}

// Laborator optic: balon de laborator, cu linia de lichid.
function FlaskFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <path d="M10 4h4M10.5 4v4.3l-4 7.6a2 2 0 0 0 1.8 2.9h7.4a2 2 0 0 0 1.8-2.9l-4-7.6V4" />
      <path d="M8.2 14.6h7.6" />
    </svg>
  );
}

// Zona de investigatii oftalmologice: cercuri concentrice, ca o scanare.
function ScanFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Zona de proceduri: o picatura, pentru interventiile cu picaturi/instilatii.
function DropletFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <path d="M12 3.6c3.1 3.9 5.4 7.3 5.4 10a5.4 5.4 0 1 1-10.8 0c0-2.7 2.3-6.1 5.4-10Z" />
    </svg>
  );
}

// Unitate de chirurgie: cruce intr-un scut, distincta de cercul simplu al cabinetului.
function ShieldCrossFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <path d="M12 3.6 19 6.4v5.2c0 3.9-3 6.8-7 8.6-4-1.8-7-4.7-7-8.6V6.4L12 3.6Z" />
      <path d="M12 8.6v5.8M9.1 11.5h5.8" />
    </svg>
  );
}

// Distributie B2B: un colet, cu muchiile vazute.
function CrateFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <path d="M12 3.6 19.6 8v8L12 20.4 4.4 16V8L12 3.6Z" />
      <path d="M4.4 8 12 12.4 19.6 8M12 12.4v8" />
    </svg>
  );
}

// Rezerva, pentru orice cheie fara figurina proprie: o cladire simpla.
function BuildingFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>
      <rect x="6.2" y="4.6" width="11.6" height="14.8" rx="1.2" />
      <path d="M9.3 8.4h1M13.7 8.4h1M9.3 11.8h1M13.7 11.8h1M9.3 15.2h1M13.7 15.2h1" />
      <rect x="10.2" y="16.4" width="3.6" height="3" rx="0.5" />
    </svg>
  );
}

export const UNIT_FIGURES = {
  optical_store: StoreFigure,
  optical_cabinet: GlassesFigure,
  optometry_cabinet: EyeFigure,
  ophthalmology_office: MedicalCrossFigure,
  optical_workshop: WrenchFigure,
  optical_laboratory: FlaskFigure,
  ophthalmology_diagnostics: ScanFigure,
  ophthalmology_procedure_room: DropletFigure,
  ophthalmology_surgery_unit: ShieldCrossFigure,
  b2b_distribution_center: CrateFigure,
};

export const UNIT_FIGURE_FALLBACK = BuildingFigure;
