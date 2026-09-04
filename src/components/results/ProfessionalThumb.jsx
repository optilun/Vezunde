import React from "react";
import { Eye, Glasses, Stethoscope, User } from "lucide-react";
import {
  professionalInitials,
  professionalTypeIconKey,
  professionalTypeLabel,
} from "../../../shared/professionalIdentity.js";

// Miniatura specialistului.
//
// 2026-09-03. Aceleasi reguli si aceleasi tokenuri ca LocationThumb, deliberat: cele doua tipuri
// de rezultat stau unul langa altul in aceeasi lista si trebuie sa arate ca acelasi produs.
// Diferenta de continut e ca aici tile-ul poarta pictograma profesiei, nu a tipului de locatie -
// pacientul trebuie sa vada dintr-o privire daca se uita la un oftalmolog sau la un optician.
//
// Majoritatea profilurilor nu au fotografie. Nu punem o silueta generica identica pentru toti,
// pentru ca ar face lista sa arate a placeholder rupt; tile-ul generat poarta informatie.
const ICONS = {
  stethoscope: Stethoscope,
  eye: Eye,
  glasses: Glasses,
  user: User,
};

const TILES = {
  ophthalmologist: "bg-accent text-foreground/75",
  optometrist: "bg-secondary text-foreground/70",
  optician: "bg-muted text-foreground/70",
};

export default function ProfessionalThumb({
  professional,
  size = "md",
  className = "",
}) {
  const type = professional?.professional_type;
  const Icon = ICONS[professionalTypeIconKey(type)] || User;
  const tile = TILES[type] || "bg-muted text-foreground/70";
  const box = size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const photoUrl = professional?.profile_photo_url;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        loading="lazy"
        className={`${box} shrink-0 border border-border object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      title={professionalTypeLabel(type)}
      className={`${box} ${tile} flex shrink-0 flex-col items-center justify-center gap-0.5 border border-border/70 ${className}`}
    >
      <Icon className={iconSize} strokeWidth={1.75} />
      <span className="font-heading text-[10px] font-bold leading-none tracking-wide">
        {professionalInitials(professional)}
      </span>
    </span>
  );
}
