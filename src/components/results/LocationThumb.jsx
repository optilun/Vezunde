import React from "react";
import { Building2, Eye, Glasses, Stethoscope } from "lucide-react";

// Vizualul de card pentru rezultate si liste de locatii.
//
// Aproape toate profilurile din director au photo_url gol, deci nu ne putem baza pe fotografie.
// In lipsa ei generam un tile din tokenurile aplicatiei: pictograma tipului + initialele locatiei.
// Nu folosim o imagine generica unica, pentru ca ar face toate rezultatele identice vizual si
// ar arata a placeholder rupt. Tile-ul generat poarta informatie: tipul se citeste dintr-o privire.
//
// Tonurile raman in familia calda a paletei (crem / secondary / accent), fara culori tipatoare.
const TYPE_VISUALS = {
  optica_medicala: {
    Icon: Glasses,
    label: "Optică",
    tile: "bg-secondary text-foreground/70",
  },
  cabinet_optometric: {
    Icon: Eye,
    label: "Cabinet optometric",
    tile: "bg-secondary text-foreground/70",
  },
  clinica_oftalmologica: {
    Icon: Building2,
    label: "Clinică oftalmologică",
    tile: "bg-accent text-foreground/75",
  },
  cabinet_oftalmologic: {
    Icon: Stethoscope,
    label: "Cabinet oftalmologic",
    tile: "bg-accent text-foreground/75",
  },
  laborator_optic: {
    Icon: Glasses,
    label: "Laborator optic",
    tile: "bg-muted text-foreground/70",
  },
};

const FALLBACK_VISUAL = {
  Icon: Building2,
  label: "Locație",
  tile: "bg-muted text-foreground/70",
};

export function typeVisual(providerType) {
  return TYPE_VISUALS[providerType] || FALLBACK_VISUAL;
}

function initialsFor(name) {
  const words = String(name || "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Miniatura locatiei. Foloseste fotografia reala cand exista, altfel un tile generat.
 * size: "sm" (liste dense) sau "md" (carduri de rezultat).
 */
export default function LocationThumb({ name, photoUrl, providerType, size = "md", className = "" }) {
  const visual = typeVisual(providerType);
  const { Icon } = visual;
  const box = size === "sm" ? "h-12 w-12 rounded-xl" : "h-16 w-16 rounded-2xl";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

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
      className={`${box} ${visual.tile} flex shrink-0 flex-col items-center justify-center gap-0.5 border border-border/70 ${className}`}
    >
      <Icon className={iconSize} strokeWidth={1.75} />
      <span className="font-heading text-[10px] font-bold leading-none tracking-wide">{initialsFor(name)}</span>
    </span>
  );
}
