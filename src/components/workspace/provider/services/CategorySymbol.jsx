// Reper de categorie, forma REALA folosita pe homepage (2026-08-19, corectat dupa
// capturi trimise de Alex). Prima incercare a folosit path-ul complex din
// viasee-symbol.svg (favicon-ul site-ului) - gresit. Forma corecta e "RoleMark" din
// SituationExplainer.jsx: o steluta simpla, din patru dreptunghiuri rotunjite, cu un
// mic patrat in centru umplut cu insasi culoarea de fundal - acelasi tipar exact, aici
// parametrizat pe culorile de categorie (GROUP_TONE), nu doar albastru.
import React from "react";

export default function CategorySymbol({ color, className = "h-5 w-5" }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-[0.35rem] ${className}`}
      style={{ backgroundColor: color }}
    >
      <svg viewBox="0 0 40 40" className="h-[62%] w-[62%]" fill="#f8f4ec">
        <rect x="17" y="3" width="6" height="34" rx="2" />
        <rect x="3" y="17" width="34" height="6" rx="2" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(45 20 20)" />
        <rect x="17" y="3" width="6" height="34" rx="2" transform="rotate(135 20 20)" />
        <rect x="16" y="16" width="8" height="8" rx="1.5" fill={color} />
      </svg>
    </span>
  );
}
