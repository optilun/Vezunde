import React from "react";
import { ArrowRight, Stethoscope } from "lucide-react";

// 2026-10-03 (structura conturilor, pasul 1). „Echipă” are doua parti: cine lucreaza in contul
// organizatiei (Acces si utilizatori, mai sus) si cine apare public ca specialist la fiecare
// locatie (aici). Afisarea publica se gestioneaza in continuare din pagina „Specialiști” a locatiei.
export default function ProviderTeamSpecialistsLinks({ locations = [], canOpen = () => true, onOpenModule }) {
  const items = locations.filter((location) => location.active_status !== "inactiva" && canOpen(location.id));
  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-[20px] border border-foreground/10 bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2"><Stethoscope className="h-5 w-5" /><h2 className="text-lg font-bold">Specialiști afișați public</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Optometriștii, oftalmologii și opticienii care apar pe pagina fiecărei locații. Fiecare apare doar cu acordul lui și nu primește prin asta acces la contul organizației.</p>
      </div>
      <div className="divide-y divide-border/70">
        {items.map((location) => (
          <div key={location.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">{location.public_display_name || location.name || "Locație"}</div>
              {(location.locality_name || location.city) && <div className="mt-1 text-xs text-muted-foreground">{location.locality_name || location.city}</div>}
            </div>
            <button
              type="button"
              onClick={() => onOpenModule?.("specialisti", location.id)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              Gestionează specialiștii <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
