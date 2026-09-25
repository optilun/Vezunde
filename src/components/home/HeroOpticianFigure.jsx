import React from "react";

// Figurina de optician de la cusatura dintre primul ecran si foaia rotunjita cu "Servicii și
// specialiști". Desenata doar din forme plate (cercuri, dreptunghiuri rotunjite, linii groase), in
// acelasi limbaj ca pictogramele ShapeTile din CategoryShowcase, fara gradiente si fara umbre.
//
// Figura e impartita in doua straturi cu acelasi sistem de coordonate (240 x 240):
//  - corpul (cap, halat, brate) sta SUB foaie, deci partea de jos dispare sub marginea ei;
//  - mainile stau DEASUPRA foii, ca degetele sa para ca apuca marginea.
// Linia marginii foii e la y = 180 in desen, adica la 75% din inaltime: de aici translate-y-[-75%].
// Pe ecrane mici (fara efectul de pin) figura nu se afiseaza, ca sa nu incarce layout-ul.

const SEAM_WRAPPER =
  "pointer-events-none absolute top-0 hidden aspect-square w-[12rem] -translate-y-[75%] lg:block xl:w-[15rem]";
const SEAM_POSITION = { right: "max(3rem, calc(50% - 38rem))" };

const INK = "#171717";
const COAT = "#FFFDF8";
const SKIN = "rgb(228,167,134)";
const PLUM = "#684d78";
const SAGE_BLUE = "rgb(169,198,215)";
const AMBER = "rgb(211,181,101)";
const LAVENDER = "rgb(190,169,200)";
const CREAM = "#F8F4EC";

// Maneca: contur gros negru si umplutura alba peste el (acelasi traseu, doua grosimi).
function Sleeve({ d }) {
  return (
    <>
      <path d={d} stroke={INK} strokeWidth="34" strokeLinecap="round" />
      <path d={d} stroke={COAT} strokeWidth="27" strokeLinecap="round" />
    </>
  );
}

export function OpticianFigureBody() {
  return (
    <div aria-hidden="true" className={`${SEAM_WRAPPER} z-0`} style={SEAM_POSITION}>
      <svg viewBox="0 0 240 240" className="h-full w-full" fill="none">
        {/* Colturi de tip "corner bracket", ca la placutele ShapeTile. */}
        <g stroke={INK} strokeWidth="2" opacity="0.3">
          <path d="M60 30V18H72" />
          <path d="M168 18H180V30" />
        </g>
        <circle cx="190" cy="44" r="5" fill={AMBER} />
        <rect x="42" y="58" width="9" height="9" rx="2" fill={LAVENDER} />

        {/* Halatul: forma solida, cu tricoul sage in decolteu si reverele marcate prin linii. */}
        <rect x="46" y="126" width="148" height="140" rx="46" fill={COAT} stroke={INK} strokeWidth="3" />
        <path d="M100 128H140L120 170Z" fill={SAGE_BLUE} />
        <path d="M98 127L120 172L142 127" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M120 172V240" stroke={INK} strokeWidth="2" opacity="0.4" />

        {/* Ecuson (stanga) si buzunar cu o pereche de ochelari de rezerva (dreapta). */}
        <rect x="64" y="146" width="24" height="11" rx="2.5" fill={PLUM} />
        <circle cx="152" cy="146" r="6" stroke={INK} strokeWidth="2.5" fill={CREAM} />
        <circle cx="166" cy="146" r="6" stroke={INK} strokeWidth="2.5" fill={CREAM} />
        <path d="M158 145H160" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        <rect x="144" y="150" width="30" height="20" rx="3" fill={COAT} stroke={INK} strokeWidth="2.5" />

        {/* Bratele coboara spre marginea foii (mainile sunt in stratul de deasupra). */}
        <Sleeve d="M62 146L38 176" />
        <Sleeve d="M178 146L202 176" />

        {/* Gat si cap: cerc simplu, fara trasaturi realiste. */}
        <rect x="109" y="106" width="22" height="26" rx="7" fill={SKIN} />
        <g className="home-optician-head">
          <circle cx="120" cy="82" r="34" fill={SKIN} />
          <path d="M86 84A34 34 0 0 1 154 84Q140 66 118 70Q98 73 86 84Z" fill={PLUM} />

          {/* Ochelarii purtati: doua lentile rotunde unite printr-o punte. */}
          <path d="M92 88H86M148 88H154" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="106" cy="89" r="12" fill={CREAM} stroke={INK} strokeWidth="4" />
          <circle cx="134" cy="89" r="12" fill={CREAM} stroke={INK} strokeWidth="4" />
          <path d="M118 87Q120 84 122 87" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
          <g className="home-optician-blink">
            <circle cx="108" cy="90" r="4" fill={INK} />
            <circle cx="136" cy="90" r="4" fill={INK} />
          </g>
          <path d="M114 108H126" stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}

export function OpticianFigureHands() {
  return (
    <div aria-hidden="true" className={`${SEAM_WRAPPER} z-20`} style={SEAM_POSITION}>
      <svg viewBox="0 0 240 240" className="h-full w-full" fill="none">
        {[34, 206].map((cx) => (
          <g key={cx}>
            {/* Mansetele halatului, chiar deasupra marginii. */}
            <rect x={cx - 18} y="164" width="36" height="12" rx="4" fill={COAT} stroke={INK} strokeWidth="3" />
            {/* Palma si degetele care trec peste marginea foii. */}
            <rect x={cx - 15} y="174" width="30" height="20" rx="9" fill={SKIN} />
            <path
              d={`M${cx - 7} 184V192M${cx} 184V193M${cx + 7} 184V192`}
              stroke={INK}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.35"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
