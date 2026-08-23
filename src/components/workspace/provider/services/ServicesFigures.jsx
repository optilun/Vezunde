// Figurinele modulului Servicii (2026-08-23), in acelasi stil ca in Prezentare generala:
// desenate aici, fara imagini externe, din cercuri punctate si tonurile paletei. Nu
// consuma credite, nu se incarca din retea si nu se bat cap in cap cu estetica editoriala
// a aplicatiei - motivul pentru care modulul nu foloseste emoji sau imagini generate.
import React from "react";

// Nimic bifat inca: o lista goala, cu doua randuri stinse.
export function FigureNothingSelected() {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Nimic selectat" className="h-20 w-20" fill="none">
      <circle cx="60" cy="60" r="44" stroke="#8d7658" strokeWidth="1.2" strokeDasharray="3 8" opacity="0.45" />
      <rect x="34" y="34" width="52" height="52" rx="12" fill="#f5f1e9" stroke="#e3ddd0" strokeWidth="1.2" />
      <rect x="44" y="50" width="13" height="13" rx="4" fill="#ffffff" stroke="rgb(23 23 23 / 0.22)" strokeWidth="1.2" />
      <rect x="63" y="54" width="15" height="4.5" rx="2.25" fill="#171717" opacity="0.16" />
      <rect x="44" y="69" width="13" height="13" rx="4" fill="#ffffff" stroke="rgb(23 23 23 / 0.22)" strokeWidth="1.2" />
      <rect x="63" y="73" width="11" height="4.5" rx="2.25" fill="#171717" opacity="0.1" />
    </svg>
  );
}

// Nicio resursa asociata: doua siluete si o unealta, in tonurile de zona.
export function FigureNoResources() {
  return (
    <svg viewBox="0 0 120 120" role="img" aria-label="Nicio resursă asociată" className="h-16 w-16" fill="none">
      <circle cx="60" cy="60" r="42" stroke="#8d7658" strokeWidth="1.1" strokeDasharray="3 8" opacity="0.4" />
      <circle cx="49" cy="50" r="9" fill="#dce5e9" stroke="#c6d3da" strokeWidth="1.2" />
      <path d="M34 76c0-8.3 6.7-15 15-15s15 6.7 15 15" stroke="#c6d3da" strokeWidth="1.4" fill="#dce5e9" strokeLinecap="round" />
      <circle cx="74" cy="58" r="7" fill="#eadcba" stroke="#dac69b" strokeWidth="1.2" />
      <path d="M63 78c0-6.1 4.9-11 11-11s11 4.9 11 11" stroke="#dac69b" strokeWidth="1.4" fill="#eadcba" strokeLinecap="round" />
    </svg>
  );
}
