import React, { useId } from "react";
import SpecialistsPortrait from "./SpecialistsPortrait";
import { OpticalPracticeIllustration } from "./SpecialistsArtworks";

function LocationTile({ x, label }) {
  return (
    <g transform={`translate(${x} 318)`}>
      <rect width="192" height="124" rx="14" fill="#FFFDF7" stroke="#BCCBF3" strokeWidth="1.5" />
      <rect x="12" y="14" width="58" height="66" rx="7" fill="#E7ECFE" />
      <path d="M12 41L70 57M37 14L45 80M14 66L65 20" stroke="#FFFDF7" strokeWidth="5" />
      <path d="M41 66C41 66 28 48 28 39A13 13 0 0 1 54 39C54 48 41 66 41 66Z" fill="#405AE9" />
      <circle cx="41" cy="39" r="4" fill="#FFFDF7" />
      <text x="82" y="35" fill="#242733" fontFamily="inherit" fontSize="13" fontWeight="700">{label}</text>
      <text x="82" y="56" fill="#657087" fontFamily="inherit" fontSize="10">Adresă și contact</text>
      <text x="82" y="74" fill="#657087" fontFamily="inherit" fontSize="10">Program · Servicii</text>
      <path d="M12 93H180" stroke="#DCE3F6" />
      <circle cx="18" cy="108" r="3" fill="#405AE9" />
      <text x="28" y="111" fill="#657087" fontFamily="inherit" fontSize="9">Date pentru acest punct de lucru</text>
    </g>
  );
}

export default function SpecialistsLocationArtwork({ audience = "organization" }) {
  const professional = audience === "professional";
  const patternId = useId();

  return (
    <div aria-hidden="true" className="pointer-events-none hidden select-none lg:block">
      <svg viewBox="0 0 480 480" fill="none" className="w-full">
        <defs>
          <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".8" fill="#C6D1EB" />
          </pattern>
        </defs>
        <rect x="8" y="15" width="464" height="450" rx="26" fill="#F0F2F8" />
        <rect x="8" y="15" width="464" height="450" rx="26" fill={`url(#${patternId})`} />
        <path d="M13 136L465 347M72 460L216 18M273 460L420 18M14 354L465 100" stroke="#FFFDF7" strokeWidth="14" />
        <path d="M39 49H77M58 30V68" stroke="#BCCBF3" strokeWidth="1.5" />
        <circle cx="420" cy="57" r="11" stroke="#BCCBF3" strokeWidth="1.5" />
        <rect x="160" y="28" width="160" height="28" rx="14" fill="#FFFDF7" stroke="#DCE3F6" />
        <circle cx="177" cy="42" r="3" fill="#405AE9" />
        <text x="189" y="46" fill="#657087" fontFamily="inherit" fontSize="10" fontWeight="600">Profilul tău pe VIASEE</text>
        <path d="M240 244V279M118 318V300Q118 279 139 279H341Q362 279 362 300V318" stroke="#405AE9" strokeWidth="2" strokeDasharray="5 4" />
        <circle cx="240" cy="265" r="6" fill="#405AE9" stroke="#FFFDF7" strokeWidth="3" />
        <circle cx="118" cy="316" r="4" fill="#405AE9" /><circle cx="362" cy="316" r="4" fill="#405AE9" />
        <g key={audience} className="animate-in fade-in duration-300 motion-reduce:animate-none">
          <rect x="62" y="84" width="356" height="160" rx="18" fill="#242733" opacity=".05" transform="translate(0 5)" />
          <rect x="62" y="84" width="356" height="160" rx="18" fill="#FFFDF7" stroke="#BCCBF3" strokeWidth="1.5" />
          {professional ? (
            <svg x="77" y="100" width="94" height="106" viewBox="0 0 240 270">
              <SpecialistsPortrait />
            </svg>
          ) : (
            <svg x="77" y="103" width="104" height="99" viewBox="0 0 320 200">
              <OpticalPracticeIllustration />
            </svg>
          )}
          <text x="195" y="127" fill="#242733" fontFamily="inherit" fontSize={professional ? 17 : 20} fontWeight="700">
            {professional ? "Profil profesional" : "Organizație"}
          </text>
          <text x="195" y="149" fill="#657087" fontFamily="inherit" fontSize="11">
            {professional ? "Oftalmolog · Optometrist · Optician" : "Optică · Clinică · Cabinet"}
          </text>
          <rect x="195" y="165" width="129" height="24" rx="12" fill="#E7ECFE" />
          <text x="259.5" y="180" textAnchor="middle" fill="#405AE9" fontFamily="inherit" fontSize="10" fontWeight="600">Un profil, două locații</text>
          <path d="M77 218H400" stroke="#DCE3F6" />
          <text x="81" y="233" fill="#657087" fontFamily="inherit" fontSize="10">Profil</text>
          <text x="143" y="233" fill="#657087" fontFamily="inherit" fontSize="10">Locații</text>
          <text x="217" y="233" fill="#657087" fontFamily="inherit" fontSize="10">Date publice</text>
          <path d="M387 225L393 231L387 237M380 231H393" stroke="#405AE9" strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <LocationTile x={22} label="Locația 1" />
        <LocationTile x={266} label="Locația 2" />
        <text x="240" y="461" textAnchor="middle" fill="#657087" fontFamily="inherit" fontSize="10">Fiecare locație are propriile informații.</text>
      </svg>
    </div>
  );
}

