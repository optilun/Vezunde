// Figurine desenate pentru cardurile "Spatiile existente" (2026-08-23), la cererea lui
// Alex: acelasi gen ca figurinele din Prezentare generala, "si cu cerc punctat".
// Referinta exacta e FigureQuiet din ProviderOverview.jsx: un cerc punctat, o piesa in
// tonul paletei, o piesa mai deschisa peste ea si cateva detalii in cerneala translucida.
//
// Patru materiale, luate 1:1 de acolo:
//   RING  - cercul punctat, #8d7658 la 0.45 - ramul figurinei;
//   p.bg  - piesa in tonul categoriei (tonurile din CategoryShowcase, prin UNIT_TONE);
//   LIGHT - piesa deschisa care se suprapune peste ea (#fdfbf6 pe #e3ddd0);
//   INK   - detaliile mici, negru la opacitate mica, exact ca randurile foii.
//
// SCARA. Referinta deseneaza intr-un viewBox 120 randat la 96px (raport 0.8): cercul are
// r=46, grosimea 1.2 si liniuta "3 8", adica pe ecran 0.96px grosime si 2.4/6.4px liniuta.
// Aici figurina e randata la 48px dintr-un viewBox 24 (raport 2), deci toate grosimile
// sunt recalculate ca sa cada pe EXACT aceleasi valori pe ecran - altfel cercul punctat
// s-ar rupe in pixeli, care e chiar motivul pentru care prima versiune nu il avea.
// Desenul propriu-zis sta intr-un grup scalat la 0.82, ca sa umple cercul in aceeasi
// proportie ca foile din referinta (~80% din diametru), iar grosimea din grup e impartita
// inapoi la scara ca sa cada tot pe 0.96px.
//
// Liniuta cercului NU e cea din referinta la scara: cercul de aici are, pe ecran, jumatate
// din diametrul celui de acolo, deci aceeasi liniuta ar fi dat jumatate din numarul de
// segmente si o textura vizibil mai rara. "0.85 2.2" pastreaza densitatea, care e ceea ce
// se citeste de fapt ca "acelasi cerc punctat", nu lungimea segmentului.
//
// Culoarea vine din UNIT_TONE, nu din currentColor: la fel ca in Prezentare generala,
// figurina isi poarta tonul categoriei in ea. Starea ramane treaba fondului de card
// (regula modulului), iar pentru cardul propus spre eliminare figurina trece pe perechea
// portocalie deja folosita in modul.
//
// Domeniu deliberat restrans (decizie explicita a lui Alex): figurinele inlocuiesc
// iconitele Lucide DOAR pe acest ecran (UnitPicker.jsx). Randul din coloana din stanga
// ("Oferta pe zone") si antetul cardului de grup raman pe UNIT_ICONS din
// servicesUiTokens.js, neatinse - nu e o scapare, e scopul cerut.
import React from "react";

const RING = { fill: "none", stroke: "#8d7658", strokeWidth: 0.48, strokeDasharray: "0.85 2.2", opacity: 0.45 };
const LIGHT_FILL = "#fdfbf6";
const INK = "#171717";
// Zona B2B nu are ton (decizie veche, documentata in servicesUiTokens.js): nu e una din
// categoriile de pe homepage. Primeste cremul neutru al modulului, nu o culoare inventata.
const NEUTRAL = { bg: "#f5f1e9", border: "#e3ddd0" };
// Perechea de eliminare e cea deja folosita in modul pentru aceeasi stare.
const REMOVAL = { bg: "#efd5c5", border: "#e1bda8" };

function palette(tone, removal) {
  if (removal) return REMOVAL;
  if (tone && tone.bg && tone.border) return { bg: tone.bg, border: tone.border };
  return NEUTRAL;
}

// Ramul comun: cercul punctat plus grupul scalat in care sta desenul.
function Figure({ className, children }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none">
      <circle cx="12" cy="12" r="9.2" {...RING} />
      <g transform="translate(12 12) scale(0.82) translate(-12 -12)" strokeWidth={0.58} strokeLinejoin="round" strokeLinecap="round">
        {children}
      </g>
    </svg>
  );
}

// Magazin optic: pravalia deschisa la culoare, cu copertina in tonul categoriei.
function StoreFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M4.6 9.4h14.8v9a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4Z" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M3.4 9.4 5.9 4.3h12.2l2.5 5.1Z" fill={p.bg} stroke={p.border} />
      <path d="M10.2 19.8v-4.3a1.8 1.8 0 0 1 3.6 0v4.3Z" fill={p.border} stroke="none" />
    </Figure>
  );
}

// Cabinet de optica: ochelari rotunjiti, lentilele in tonul categoriei.
function GlassesFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M10.6 11.6h2.8M2.1 10.3l1.8.7M21.9 10.3l-1.8.7" stroke={p.border} />
      <rect x="3.1" y="8.6" width="7.6" height="6.9" rx="3.45" fill={p.bg} stroke={p.border} />
      <rect x="13.3" y="8.6" width="7.6" height="6.9" rx="3.45" fill={p.bg} stroke={p.border} />
      <path d="M5.4 10.6a2.7 2.7 0 0 0-.5 2.9M15.6 10.6a2.7 2.7 0 0 0-.5 2.9" stroke={LIGHT_FILL} />
    </Figure>
  );
}

// Cabinet optometric: ochiul deschis la culoare, cu irisul in tonul categoriei.
function EyeFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M2.4 12c2.5-4.2 5.9-6.4 9.6-6.4s7.1 2.2 9.6 6.4c-2.5 4.2-5.9 6.4-9.6 6.4S4.9 16.2 2.4 12Z" fill={LIGHT_FILL} stroke={p.border} />
      <circle cx="12" cy="12" r="3.4" fill={p.bg} stroke={p.border} />
      <circle cx="12" cy="12" r="1.35" fill={INK} opacity={0.5} stroke="none" />
    </Figure>
  );
}

// Cabinet oftalmologic: crucea medicala pe un disc in tonul categoriei.
function MedicalCrossFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <circle cx="12" cy="12" r="8.3" fill={p.bg} stroke={p.border} />
      <path d="M10.7 7.3h2.6v3.4h3.4v2.6h-3.4v3.4h-2.6v-3.4H7.3v-2.6h3.4Z" fill={INK} opacity={0.42} stroke="none" />
    </Figure>
  );
}

// Atelier optic si montaj: cheia fixa, o singura silueta in tonul categoriei.
function WrenchFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M18.4 6.4a3.6 3.6 0 0 1-4.7 4.7L6.9 17.9l-2-2 6.8-6.8a3.6 3.6 0 0 1 4.7-4.7l-2.3 2.3 1.6 1.6 2.3-2.3Z" fill={p.bg} stroke={p.border} />
    </Figure>
  );
}

// Laborator optic: balonul deschis la culoare, cu lichidul in tonul categoriei.
function FlaskFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M10 3.9v4.5l-4.3 7.9a1.9 1.9 0 0 0 1.7 2.8h9.2a1.9 1.9 0 0 0 1.7-2.8L14 8.4V3.9Z" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M6.6 15.3 5.7 16.3a1.9 1.9 0 0 0 1.7 2.8h9.2a1.9 1.9 0 0 0 1.7-2.8l-.9-1Z" fill={p.bg} stroke={p.border} />
      <rect x="9.4" y="2.9" width="5.2" height="1.9" rx="0.95" fill={p.border} stroke="none" />
    </Figure>
  );
}

// Zona de investigatii: cercuri concentrice, ca o tinta de scanare.
function ScanFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <circle cx="12" cy="12" r="8.3" fill={p.bg} stroke={p.border} />
      <circle cx="12" cy="12" r="4.5" fill={LIGHT_FILL} stroke={p.border} />
      <circle cx="12" cy="12" r="1.5" fill={INK} opacity={0.45} stroke="none" />
    </Figure>
  );
}

// Zona de proceduri: picatura, cu reflexul deschis pe interior.
function DropletFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M12 3.4c3.2 4 5.5 7.4 5.5 10.1a5.5 5.5 0 1 1-11 0c0-2.7 2.3-6.1 5.5-10.1Z" fill={p.bg} stroke={p.border} />
      <path d="M9.2 14.2a2.9 2.9 0 0 0 1.9 2.8" stroke={LIGHT_FILL} />
    </Figure>
  );
}

// Unitate de chirurgie: crucea intr-un scut - vecina cabinetului, dar clar alta forma.
function ShieldCrossFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M12 3.3 19.3 6.2v5.4c0 4-3.1 7.1-7.3 8.9-4.2-1.8-7.3-4.9-7.3-8.9V6.2Z" fill={p.bg} stroke={p.border} />
      <path d="M10.9 8.2h2.2v2.9h2.9v2.2h-2.9v2.9h-2.2v-2.9H8v-2.2h2.9Z" fill={INK} opacity={0.4} stroke="none" />
    </Figure>
  );
}

// Distributie B2B: coletul vazut in perspectiva, cu capacul mai inchis.
function CrateFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M12 3.3 19.9 7.8v8.4L12 20.7 4.1 16.2V7.8Z" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M12 3.3 19.9 7.8 12 12.3 4.1 7.8Z" fill={p.bg} stroke={p.border} />
      <path d="M12 12.3v8.4" stroke={p.border} />
    </Figure>
  );
}

// Rezerva, pentru orice cheie fara figurina proprie: o cladire simpla.
function BuildingFigure({ className, tone, removal }) {
  const p = palette(tone, removal);
  return (
    <Figure className={className}>
      <path d="M6.1 5.1a1.5 1.5 0 0 1 1.5-1.5h8.8a1.5 1.5 0 0 1 1.5 1.5v14.6H6.1Z" fill={LIGHT_FILL} stroke={p.border} />
      <path d="M9 7.6h1.9v1.9H9Zm4.1 0H15v1.9h-1.9ZM9 11.6h1.9v1.9H9Zm4.1 0H15v1.9h-1.9Z" fill={p.bg} stroke="none" />
      <path d="M10.3 19.7v-2.9a1.7 1.7 0 0 1 3.4 0v2.9Z" fill={p.border} stroke="none" />
    </Figure>
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
