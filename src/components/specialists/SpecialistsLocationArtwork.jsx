import React from "react";
import SpecialistsPortrait from "./SpecialistsPortrait";

function LocationTile({ x, label }) {
  return (
    <g transform={`translate(${x} 284)`}>
      <rect width="154" height="110" rx="16" fill="#FFFDF7" stroke="#C4D6CC" strokeWidth="1.5" />
      <rect x="11" y="11" width="132" height="56" rx="9" fill="#E5EEE8" />
      <path d="M11 44L143 31M46 11L69 67M111 11L88 67" stroke="#FFFDF7" strokeWidth="5" />
      <path d="M77 58C77 58 64 42 64 33C64 25 70 20 77 20C84 20 90 25 90 33C90 42 77 58 77 58Z" fill="#2E6666" />
      <circle cx="77" cy="33" r="4" fill="#FFFDF7" />
      <text x="77" y="88" textAnchor="middle" fill="#263B37" fontFamily="inherit" fontSize="12" fontWeight="600">{label}</text>
    </g>
  );
}

export default function SpecialistsLocationArtwork({ audience = "organization" }) {
  const professional = audience === "professional";

  return (
    <div aria-hidden="true" className="pointer-events-none hidden select-none lg:block">
      <svg viewBox="0 0 480 450" fill="none" className="w-full">
        <rect x="12" y="16" width="456" height="418" rx="32" fill="#F1EFEB" />
        <path d="M20 106L460 310M59 433L200 18M290 433L412 18M20 347L460 107" stroke="#FFFDF7" strokeWidth="15" />
        <path d="M240 202V243M126 284V260Q126 243 143 243H337Q354 243 354 260V284" stroke="#73998E" strokeWidth="2" strokeDasharray="5 5" />
        <circle cx="240" cy="220" r="4" fill="#2E6666" />
        <g key={audience} className="animate-in fade-in duration-300 motion-reduce:animate-none">
          <rect x="103" y="63" width="274" height="139" rx="20" fill="#FFFDF7" stroke="#C4D6CC" strokeWidth="1.5" />
          {professional ? (
            <svg x="117" y="78" width="86" height="107" viewBox="0 0 240 250">
              <SpecialistsPortrait />
            </svg>
          ) : (
            <g transform="translate(129 90)">
              <rect width="66" height="76" rx="14" fill="#E4EFEB" />
              <rect x="15" y="16" width="24" height="44" rx="3" stroke="#2E6666" strokeWidth="2.5" />
              <path d="M39 31H51V60M12 60H54M22 24H25M22 33H25M22 42H25M30 24H33M30 33H33M30 42H33M45 38H47M45 47H47" stroke="#2E6666" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M25 60V50H31V60" stroke="#2E6666" strokeWidth="2.5" />
            </g>
          )}
          <text x="218" y="119" fill="#263B37" fontFamily="inherit" fontSize={professional ? 15 : 18} fontWeight="600">
            {professional ? "Profil profesional" : "Organizație"}
          </text>
          <text x="218" y="143" fill="#59665E" fontFamily="inherit" fontSize="11">
            {professional ? "Un profil, mai multe locații" : "Un cont, mai multe locații"}
          </text>
          <rect x="218" y="157" width="87" height="5" rx="2.5" fill="#E4EFEB" />
          <rect x="313" y="157" width="39" height="5" rx="2.5" fill="#E4EFEB" />
        </g>
        <LocationTile x={49} label="Locația 1" />
        <LocationTile x={277} label="Locația 2" />
        <text x="240" y="414" textAnchor="middle" fill="#59665E" fontFamily="inherit" fontSize="11">Profiluri și locații, legate corect.</text>
      </svg>
    </div>
  );
}

