// Faza 2: introducerea pasului 5 - oferta fiecarei zone.
import React from "react";

export default function ServiceCatalogIntro({ activeUnits, selectedCount, dataAttrs = {} }) {
  return (
    <section {...dataAttrs} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Fara numerotare si fara titlu repetat: antetul ecranului spune deja unde ești.
            Rămâne o singura linie de context. */}
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">Deschide o zonă și alege oferta disponibilă. Specialiștii și dotările sunt opționale.</p>
        <span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">{selectedCount} opțiuni · {activeUnits.length} zone</span>
      </div>
    </section>
  );
}