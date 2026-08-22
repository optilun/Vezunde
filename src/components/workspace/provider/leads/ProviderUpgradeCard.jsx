// Blocul de upgrade din modulul de leaduri (2026-08-22).
//
// Un card crem se pierdea printre celelalte panouri, iar culorile vii, straine de paleta,
// nu erau o optiune. Acum blocul este negru - singura suprafata inchisa din pagina - cu un
// singur accent, luat din tonurile care exista deja in aplicatie (aceleasi ca placile de
// categorii si contoarele din inbox): panoul ilustratiei, bulinele si butonul.
//
// Ca sa schimbi accentul, schimbi doar ACCENT de mai jos cu alt ton din paleta:
//   verde #dfe3d2 / #ccd2ba · albastru #dce5e9 / #c6d3da
//   chihlimbar #eadcba / #dac69b · teracota #efd5c5 / #e1bda8
//
// Ilustratia este desenata aici, in SVG: o lentila privita din fata si doua bule de
// conversatie. Fara imagini externe.
//
// Se afiseaza doar pentru planurile fara Pro activ. Nu schimba nicio regula de acces: e un
// indemn catre pagina de planuri, atat.
import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const ACCENT = { bg: "#eadcba", border: "#dac69b" };

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

const BENEFITS = [
  "Datele complete ale clientului",
  "Răspuns direct la cerere",
  "Chat VIASEE cu clientul",
  "Telefon, după acordul clientului",
];

// Compozitie aproape patrata, nu lata: panoul ilustratiei este inalt in formatul plutitor
// si lat pe telefon, iar un desen lat lasa gol jumatate din panou. Asa umple ambele forme.
// Lentila sus, conversatia dedesubt - exact ce deblocheaza planul.
function LensIllustration() {
  return (
    <svg viewBox="0 0 240 264" role="img" aria-label="Ilustrație VIASEE" className="h-full w-full">
      <g stroke="#8d7658" strokeWidth="1.2" fill="none" opacity="0.5">
        <path d="M42 96c17-33 44-50 78-50s61 17 78 50c-17 33-44 50-78 50s-61-17-78-50z" />
        <circle cx="120" cy="96" r="74" strokeDasharray="3 8" opacity="0.6" />
      </g>

      <circle cx="120" cy="96" r="54" fill="#dce5e9" stroke="#c6d3da" strokeWidth="1.2" />
      <circle cx="120" cy="96" r="32" fill="#efd5c5" stroke="#e1bda8" strokeWidth="1.2" />
      <circle cx="120" cy="96" r="13" fill="#171717" />
      <circle cx="109" cy="84" r="5.5" fill="#ffffff" opacity="0.85" />

      <g>
        <rect x="14" y="186" width="132" height="36" rx="16" fill="#ffffff" stroke="#e3ddd0" strokeWidth="1.2" />
        <rect x="32" y="198" width="76" height="5" rx="2.5" fill="#171717" opacity="0.28" />
        <rect x="32" y="209" width="50" height="5" rx="2.5" fill="#171717" opacity="0.15" />
      </g>

      <g>
        <rect x="86" y="228" width="140" height="36" rx="16" fill="#171717" />
        <rect x="104" y="240" width="70" height="5" rx="2.5" fill="#ffffff" opacity="0.6" />
        <rect x="104" y="251" width="46" height="5" rx="2.5" fill="#ffffff" opacity="0.32" />
      </g>
    </svg>
  );
}

// O singura coloana, indiferent de latime: pe doua coloane, pe latimea blocului plutitor,
// jumatate din randuri se rupeau in doua ("Datele complete ale / clientului").
function Benefits() {
  return (
    <ul className="mt-5 space-y-2.5">
      {BENEFITS.map((benefit) => (
        <li key={benefit} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-white/85">
          <span
            aria-hidden="true"
            style={{ backgroundColor: ACCENT.bg }}
            className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
          >
            <Check className="h-2.5 w-2.5 text-black/70" />
          </span>
          {benefit}
        </li>
      ))}
    </ul>
  );
}

// "wide" sta plutitor peste modul (vezi ProviderUpgradeSpotlight).
// "sidebar" ramane pentru o coloana ingusta.
export default function ProviderUpgradeCard({ variant = "sidebar" }) {
  const wide = variant === "wide";

  return (
    // Conturul subtire detaseaza cardul de fundal: panoul chihlimbar are exact tonul placii
    // "In istoric" din antet, iar fara linie marginile se topesc una in alta.
    <aside
      className={`overflow-hidden rounded-[1.75rem] bg-[#171717] ring-1 ring-[#171717]/15 shadow-[0_26px_64px_rgba(23,23,23,0.3)] ${
        wide ? "sm:grid sm:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]" : ""
      }`}
    >
      <div
        style={{ backgroundColor: ACCENT.bg }}
        className={`relative overflow-hidden px-3 py-3 ${wide ? "h-48 sm:h-auto" : "h-44"}`}
      >
        <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
        <div className="relative z-10 flex h-full w-full items-center">
          <LensIllustration />
        </div>
      </div>

      <div className={wide ? "px-7 py-7" : "px-5 py-6"}>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">Plan Pro</p>
        <h3 className={`mt-2.5 font-heading font-extrabold leading-[1.02] tracking-[-0.04em] text-[#F8F4EC] ${wide ? "text-[2rem]" : "text-[1.5rem]"}`}>
          Vezi cererile în întregime.
        </h3>
        <p className={`mt-3 leading-relaxed text-white/60 ${wide ? "max-w-md text-[14px]" : "text-[13px]"}`}>
          Rezumatul rămâne gratuit. Restul se deschide pentru locațiile Pro aflate în Top 3.
        </p>

        <Benefits />

        <Link
          to="/plati-si-abonamente"
          style={{ backgroundColor: ACCENT.bg }}
          className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-6 font-heading text-[13px] font-bold text-[#171717] transition-opacity hover:opacity-90 ${wide ? "" : "w-full"}`}
        >
          Vezi planurile
        </Link>
      </div>
    </aside>
  );
}
