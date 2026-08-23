// Figurine desenate pentru cardurile "Spatiile existente" (2026-08-23), la cererea lui
// Alex: "emoticoanele din spatii existente de pe carduri sa le transformi in design cum
// ai mai facut in locurile ce ti-am trimis screenshot-uri". Referinta sunt figurinele de
// ecran gol (ServicesFigures.jsx, ProviderOverview.jsx): forme pline, moi, cu un contur
// fin de aceeasi familie si un accent mai dens care da adancime - nu contur subtire de
// iconita si nu emoji.
//
// Trei materiale, ca la ecranele goale:
//   MASS   - masa moale a formei: umplere translucida + contur fin;
//   ACCENT - piesa densa care da adancimea (usa, crucea, capacul, fata de sus a cutiei);
//   LINE   - doar linie, unde forma nu are corp (puntea ochelarilor, muchia cutiei).
//
// O singura diferenta fata de ecranele goale, ceruta de context: acolo figura e in tonul
// paletei asezata pe crem, aici placuta ESTE deja tonul categoriei (vezi regula din
// ProviderServicesTheme.css §20f). Raportul se inverseaza deci: masa se aseaza ca o umbra
// a tonului, iar conturul ramane cerneala. Din acelasi motiv nu exista aici cercul
// punctat al ecranelor goale - placuta de 40x40 cu tonul si chenarul ei joaca deja rolul
// de ram; un cerc punctat la 20px s-ar rupe in pixeli.
//
// Totul in currentColor, fara culori proprii: figurina urmeaza automat starile placutei -
// cerneala pe ton cand zona e aleasa, mai stinsa cand nu e, portocaliu pe alb cand e
// propusa spre eliminare. Contractul de folosire ramane identic cu al unei iconite
// Lucide (`<Icon className="..." />`), deci e inlocuire directa in SelectionCard.
//
// Domeniu deliberat restrans (decizie explicita a lui Alex): figurinele inlocuiesc
// iconitele Lucide DOAR pe acest ecran (UnitPicker.jsx). Randul din coloana din stanga
// ("Oferta pe zone") si antetul cardului de grup raman pe UNIT_ICONS din
// servicesUiTokens.js, neatinse - nu e o scapare, e scopul cerut.
import React from "react";

// Conturul e deliberat MOALE, nu cerneala plina: la figurinele de ecran gol linia e din
// aceeasi familie cu umplutura (#c6d3da peste #dce5e9), doar cu un pas mai inchisa, si
// tocmai asta le face sa arate desenate, nu iconizate. Aici nu avem tonul la indemana in
// SVG (totul merge pe currentColor, ca sa urmeze starile placutei), asa ca acelasi efect
// se obtine prin opacitate: conturul sta la 0.7, nu la 1. Mai jos de atat nu se poate
// cobori - cardul neales primeste deja opacity 0.72 pe toata placuta, si cele doua
// atenuari se inmultesc.
const MASS = { fill: "currentColor", fillOpacity: 0.2, stroke: "currentColor", strokeOpacity: 0.7, strokeWidth: 1.2, strokeLinejoin: "round", strokeLinecap: "round" };
const ACCENT = { fill: "currentColor", fillOpacity: 0.45, stroke: "none" };
const LINE = { fill: "none", stroke: "currentColor", strokeOpacity: 0.7, strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" };

// Magazin optic / showroom: copertina deasupra, corpul pravaliei, usa in mijloc.
function StoreFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M4.6 9.4h14.8v9a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4Z" {...MASS} fillOpacity={0.13} />
      <path d="M3.4 9.4 5.9 4.3h12.2l2.5 5.1Z" {...MASS} fillOpacity={0.42} />
      <path d="M10.2 19.8v-4.3a1.8 1.8 0 0 1 3.6 0v4.3Z" {...ACCENT} fillOpacity={0.5} />
    </svg>
  );
}

// Cabinet de optica: doi ochelari rotunjiti, cu lentilele pline si puntea desenata.
function GlassesFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3.1" y="8.6" width="7.6" height="6.9" rx="3.45" {...MASS} fillOpacity={0.13} />
      <rect x="13.3" y="8.6" width="7.6" height="6.9" rx="3.45" {...MASS} fillOpacity={0.13} />
      <path d="M10.6 11.6h2.8M2.1 10.3l1.6.6M21.9 10.3l-1.6.6" {...LINE} />
    </svg>
  );
}

// Cabinet optometric: ochiul, cu irisul mai dens si pupila plina.
function EyeFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M2.4 12c2.5-4.2 5.9-6.4 9.6-6.4s7.1 2.2 9.6 6.4c-2.5 4.2-5.9 6.4-9.6 6.4S4.9 16.2 2.4 12Z" {...MASS} />
      <circle cx="12" cy="12" r="3.1" {...MASS} fillOpacity={0.4} />
      <circle cx="12" cy="12" r="1.25" {...ACCENT} fillOpacity={0.75} />
    </svg>
  );
}

// Cabinet oftalmologic: crucea medicala plina, asezata intr-un disc moale.
function MedicalCrossFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.3" {...MASS} />
      <path d="M10.7 7.3h2.6v3.4h3.4v2.6h-3.4v3.4h-2.6v-3.4H7.3v-2.6h3.4Z" {...ACCENT} fillOpacity={0.6} />
    </svg>
  );
}

// Atelier optic si montaj: cheia fixa, ca o singura silueta plina.
function WrenchFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M18.4 6.4a3.6 3.6 0 0 1-4.7 4.7L6.9 17.9l-2-2 6.8-6.8a3.6 3.6 0 0 1 4.7-4.7l-2.3 2.3 1.6 1.6 2.3-2.3Z" {...MASS} />
    </svg>
  );
}

// Laborator optic: balonul, cu lichidul mai dens la fund si capacul plin sus.
function FlaskFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M10 3.9v4.5l-4.3 7.9a1.9 1.9 0 0 0 1.7 2.8h9.2a1.9 1.9 0 0 0 1.7-2.8L14 8.4V3.9Z" {...MASS} />
      <path d="M6.6 15.3 5.7 16.3a1.9 1.9 0 0 0 1.7 2.8h9.2a1.9 1.9 0 0 0 1.7-2.8l-.9-1Z" {...ACCENT} fillOpacity={0.5} />
      <rect x="9.4" y="2.9" width="5.2" height="1.9" rx="0.95" {...ACCENT} fillOpacity={0.65} />
    </svg>
  );
}

// Zona de investigatii oftalmologice: cercuri concentrice, ca o tinta de scanare.
function ScanFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.3" {...MASS} />
      <circle cx="12" cy="12" r="4.3" {...MASS} fillOpacity={0.34} />
      <circle cx="12" cy="12" r="1.35" {...ACCENT} fillOpacity={0.7} />
    </svg>
  );
}

// Zona de proceduri: picatura, cu reflexul desenat pe interior.
function DropletFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 3.4c3.2 4 5.5 7.4 5.5 10.1a5.5 5.5 0 1 1-11 0c0-2.7 2.3-6.1 5.5-10.1Z" {...MASS} />
      <path d="M9.2 14.4a2.9 2.9 0 0 0 1.8 2.7" {...LINE} strokeOpacity={0.55} />
    </svg>
  );
}

// Unitate de chirurgie: crucea intr-un scut - vecina cabinetului, dar clar alta forma.
function ShieldCrossFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 3.3 19.3 6.2v5.4c0 4-3.1 7.1-7.3 8.9-4.2-1.8-7.3-4.9-7.3-8.9V6.2Z" {...MASS} />
      <path d="M10.9 8.2h2.2v2.9h2.9v2.2h-2.9v2.9h-2.2v-2.9H8v-2.2h2.9Z" {...ACCENT} fillOpacity={0.6} />
    </svg>
  );
}

// Distributie B2B: coletul vazut in perspectiva, cu fata de sus mai densa.
function CrateFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 3.3 19.9 7.8v8.4L12 20.7 4.1 16.2V7.8Z" {...MASS} />
      <path d="M12 3.3 19.9 7.8 12 12.3 4.1 7.8Z" {...MASS} fillOpacity={0.36} />
      <path d="M12 12.3v8.4" {...LINE} strokeOpacity={0.6} />
    </svg>
  );
}

// Rezerva, pentru orice cheie fara figurina proprie: o cladire simpla.
function BuildingFigure({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M6.1 5.1a1.5 1.5 0 0 1 1.5-1.5h8.8a1.5 1.5 0 0 1 1.5 1.5v14.6H6.1Z" {...MASS} />
      <path d="M9 7.6h1.9v1.9H9Zm4.1 0H15v1.9h-1.9ZM9 11.6h1.9v1.9H9Zm4.1 0H15v1.9h-1.9Z" {...ACCENT} />
      <path d="M10.3 19.7v-2.9a1.7 1.7 0 0 1 3.4 0v2.9Z" {...ACCENT} fillOpacity={0.62} />
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
