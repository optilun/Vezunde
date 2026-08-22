// Blocul de upgrade, plutitor peste modulul de leaduri (2026-08-22).
//
// In coloana din dreapta se pierdea printre panouri. Acum apare peste continut, in dreapta
// sus pe desktop si jos pe telefon, cu un X care il inchide. Se deschide singur la fiecare
// intrare in modul si la fiecare reincarcare; butonul "Upgrade" din bara de sus il recheama.
import React, { useEffect } from "react";
import { X } from "lucide-react";
import ProviderUpgradeCard from "./ProviderUpgradeCard";
import { closeUpgradeSpotlight, useUpgradeSpotlight } from "@/lib/providerUpgradeSpotlight";

export default function ProviderUpgradeSpotlight() {
  const { open } = useUpgradeSpotlight();

  // Escape il inchide, ca orice strat plutitor.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") closeUpgradeSpotlight(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="complementary"
      aria-label="Plan Pro"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-20 sm:w-[min(660px,calc(100vw-3rem))]"
    >
      <div className="pointer-events-auto relative max-h-[85vh] overflow-y-auto rounded-[1.75rem] duration-300 animate-in fade-in slide-in-from-top-2">
        <ProviderUpgradeCard variant="wide" />
        <button
          type="button"
          onClick={closeUpgradeSpotlight}
          aria-label="Închide"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/30 outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
