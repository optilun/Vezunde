// Blocul de upgrade din modulul de leaduri (2026-08-22).
//
// Prima varianta era tot un card crem, ca toate celelalte panouri din pagina: se pierdea
// complet. Acum este singura suprafata inchisa din ecran - negrul din design system, cel
// folosit deja la pastile si butoane - asa ca sare in ochi fara sa adaug nicio culoare noua.
// Tonurile paletei raman in ilustratie, unde stralucesc pe fundal inchis.
//
// Ilustratia este desenata aici, in SVG: o lentila privita din fata si doua bule de
// conversatie. Fara imagini externe.
//
// Se afiseaza doar pentru planurile fara Pro activ. Nu schimba nicio regula de acces: e un
// indemn catre pagina de planuri, atat.
import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const BENEFITS = [
  "Datele complete ale clientului",
  "Răspuns direct la cerere",
  "Chat VIASEE cu clientul",
  "Telefon, după acordul clientului",
];

// viewBox decupat putin fata de desen, ca lentila sa umple panoul in loc sa pluteasca.
function LensIllustration() {
  return (
    <svg viewBox="18 18 288 154" role="img" aria-label="Ilustrație VIASEE" className="h-full w-full">
      <defs>
        <radialGradient id="viasee-upgrade-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#dce5e9" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#dce5e9" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="206" cy="95" r="88" fill="url(#viasee-upgrade-glow)" />

      <g stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.22">
        <path d="M144 95c14-27 36-41 62-41s48 14 62 41c-14 27-36 41-62 41s-48-14-62-41z" />
        <circle cx="206" cy="95" r="64" strokeDasharray="3 7" opacity="0.7" />
      </g>

      <circle cx="206" cy="95" r="44" fill="#dce5e9" />
      <circle cx="206" cy="95" r="26" fill="#efd5c5" />
      <circle cx="206" cy="95" r="11" fill="#171717" />
      <circle cx="197" cy="85" r="4.5" fill="#ffffff" opacity="0.8" />

      <g>
        <rect x="22" y="46" width="104" height="34" rx="15" fill="#ffffff" />
        <rect x="38" y="57" width="60" height="4" rx="2" fill="#171717" opacity="0.3" />
        <rect x="38" y="66" width="40" height="4" rx="2" fill="#171717" opacity="0.16" />
      </g>

      <g>
        <rect x="48" y="100" width="92" height="32" rx="15" fill="#ffffff" opacity="0.16" />
        <rect x="64" y="110" width="52" height="4" rx="2" fill="#ffffff" opacity="0.55" />
        <rect x="64" y="119" width="34" height="4" rx="2" fill="#ffffff" opacity="0.3" />
      </g>

      <g fill="#dfe3d2">
        <circle cx="140" cy="28" r="6" opacity="0.9" />
        <circle cx="282" cy="158" r="8" opacity="0.75" />
        <circle cx="26" cy="150" r="4" opacity="0.6" />
      </g>
    </svg>
  );
}

function Benefits({ columns }) {
  return (
    <ul className={`mt-5 gap-3 ${columns ? "grid sm:grid-cols-2" : "space-y-3"}`}>
      {BENEFITS.map((benefit) => (
        <li key={benefit} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-white/85">
          <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#dfe3d2]">
            <Check className="h-2.5 w-2.5 text-black/70" />
          </span>
          {benefit}
        </li>
      ))}
    </ul>
  );
}

// "wide" sta in coloana din dreapta, in locul gol de sub cererea neselectata.
// "sidebar" ramane pentru coloana ingusta si pentru telefon.
export default function ProviderUpgradeCard({ variant = "sidebar" }) {
  const wide = variant === "wide";

  return (
    <aside
      className={`overflow-hidden rounded-[1.75rem] bg-[#171717] shadow-[0_24px_60px_rgba(23,23,23,0.22)] ${
        wide ? "sm:grid sm:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]" : ""
      }`}
    >
      <div className={`relative overflow-hidden bg-white/[0.04] px-3 py-3 ${wide ? "h-48 sm:h-auto" : "h-44"}`}>
        <div className="flex h-full w-full items-center">
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

        <Benefits columns={wide} />

        <Link
          to="/plati-si-abonamente"
          className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#F8F4EC] px-6 font-heading text-[13px] font-bold text-[#171717] transition-opacity hover:opacity-90 ${wide ? "" : "w-full"}`}
        >
          Vezi planurile
        </Link>
      </div>
    </aside>
  );
}
