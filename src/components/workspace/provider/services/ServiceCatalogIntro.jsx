// Faza 2: introducerea pasului 5 - oferta fiecarei zone.
import React from "react";

export default function ServiceCatalogIntro({ activeUnits, selectedCount }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">5. Oferta fiecărei zone</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Deschide fiecare zonă și selectează oferta declarată ca disponibilă. Specialiștii, dotările și facilitățile pot fi completate opțional și nu blochează serviciile.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{selectedCount} opțiuni · {activeUnits.length} zone</span>
      </div>
    </section>
  );
}