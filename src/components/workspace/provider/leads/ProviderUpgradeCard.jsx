// Cardul de upgrade din coloana din stanga (2026-08-22).
//
// Arhitectura este cea dintr-un layout editorial: in stanga, sub navigatie si sub lista,
// sta un bloc dedicat cu ilustratie, beneficii si o singura actiune. Ilustratia este
// desenata aici, in SVG - fara imagini externe - din aceleasi forme si tonuri ca restul
// VIASEE: lentila (cercuri concentrice), bulele de conversatie si textura de fundal.
//
// Se afiseaza doar pentru planurile fara acces complet. Nu schimba nimic din reguli: e
// un indemn catre pagina de planuri, atat.
import React from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

const BENEFITS = [
  "Datele complete ale clientului",
  "Răspuns direct la cerere",
  "Chat VIASEE cu clientul",
  "Telefon, după acordul clientului",
];

// Ilustratie proprie: o lentila privita din fata, cu doua bule de conversatie langa ea.
// Doar forme si tonuri din paleta - nimic importat, nimic fotografic.
function LensIllustration() {
  return (
    <svg viewBox="0 0 320 170" role="img" aria-label="Ilustrație VIASEE" className="h-full w-full">
      <g opacity="0.55" stroke="#8d7658" strokeWidth="1" fill="none">
        <path d="M150 85c14-26 36-39 62-39s48 13 62 39c-14 26-36 39-62 39s-48-13-62-39z" />
        <circle cx="212" cy="85" r="62" strokeDasharray="3 6" opacity="0.5" />
      </g>

      <circle cx="212" cy="85" r="42" fill="#dce5e9" stroke="#c6d3da" />
      <circle cx="212" cy="85" r="25" fill="#efd5c5" stroke="#e1bda8" />
      <circle cx="212" cy="85" r="10" fill="#171717" opacity="0.85" />
      <circle cx="204" cy="76" r="4" fill="#ffffff" opacity="0.75" />

      <g>
        <rect x="26" y="40" width="104" height="34" rx="15" fill="#ffffff" stroke="#e3ddd0" />
        <rect x="42" y="51" width="60" height="4" rx="2" fill="#171717" opacity="0.28" />
        <rect x="42" y="60" width="40" height="4" rx="2" fill="#171717" opacity="0.16" />
        <circle cx="34" cy="80" r="4" fill="#ffffff" stroke="#e3ddd0" />
      </g>

      <g>
        <rect x="52" y="94" width="92" height="32" rx="15" fill="#171717" />
        <rect x="68" y="104" width="52" height="4" rx="2" fill="#ffffff" opacity="0.55" />
        <rect x="68" y="113" width="34" height="4" rx="2" fill="#ffffff" opacity="0.32" />
      </g>

      <g fill="#dfe3d2" stroke="#ccd2ba">
        <circle cx="146" cy="26" r="7" />
        <circle cx="286" cy="145" r="9" />
      </g>
    </svg>
  );
}

function Benefits({ columns }) {
  return (
    <ul className={`mt-4 gap-2.5 ${columns ? "grid sm:grid-cols-2" : "space-y-2.5"}`}>
      {BENEFITS.map((benefit) => (
        <li key={benefit} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-foreground">
          <span aria-hidden="true" className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#ccd2ba] bg-[#dfe3d2]">
            <Check className="h-2.5 w-2.5 text-black/60" />
          </span>
          {benefit}
        </li>
      ))}
    </ul>
  );
}

// "wide" sta in coloana din dreapta, in locul gol de sub cererea neselectata - acolo se
// vede fara sa derulezi. "sidebar" ramane pentru coloana ingusta si pentru telefon.
export default function ProviderUpgradeCard({ variant = "sidebar" }) {
  const wide = variant === "wide";

  return (
    <aside className={`overflow-hidden rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] ${wide ? "sm:grid sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]" : ""}`}>
      <div className={`relative overflow-hidden bg-[#f2ece0] px-4 py-3 ${wide ? "h-44 border-b border-[#e3ddd0] sm:h-auto sm:border-b-0 sm:border-r" : "h-40 border-b border-[#e3ddd0]"}`}>
        <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
        <div className="relative z-10 flex h-full w-full items-center">
          <LensIllustration />
        </div>
      </div>

      <div className={wide ? "px-6 py-6" : "px-5 py-5"}>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">Plan Pro</p>
        <h3 className={`mt-2 font-heading font-extrabold leading-[1.04] tracking-[-0.04em] ${wide ? "text-[1.9rem]" : "text-[1.35rem]"}`}>
          Vezi cererile în întregime.
        </h3>
        <p className={`mt-2 leading-relaxed text-muted-foreground ${wide ? "max-w-md text-[14px]" : "text-[13px]"}`}>
          Rezumatul rămâne gratuit. Restul se deschide pentru locațiile Pro aflate în Top 3.
        </p>

        <Benefits columns={wide} />

        <Link
          to="/plati-si-abonamente"
          className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#171717] px-6 font-heading text-[13px] font-bold text-white transition-opacity hover:opacity-90 ${wide ? "" : "w-full"}`}
        >
          Vezi planurile
        </Link>
      </div>
    </aside>
  );
}
