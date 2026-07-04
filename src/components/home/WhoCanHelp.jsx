import React from "react";

const HELPERS = [
  {
    title: "Optometrist",
    text: "Verifica vederea, stabileste dioptriile si recomanda ochelari sau lentile de contact. Prima oprire pentru un control de rutina.",
    examples: "Control vedere · Lentile de contact · Managementul miopiei",
  },
  {
    title: "Optician",
    text: "Monteaza lentile, ajusteaza si repara rame. Persoana potrivita cand ochelarii tai au nevoie de atentie.",
    examples: "Reparatii ochelari · Reglaj rame · Montaj lentile",
  },
  {
    title: "Medic oftalmolog",
    text: "Consulta, investigheaza si trateaza afectiunile ochilor. Alegerea potrivita pentru simptome, boli oculare sau chirurgie.",
    examples: "Consult oftalmologic · Glaucom · Cataracta · OCT",
  },
];

export default function WhoCanHelp() {
  return (
    <section className="max-w-5xl mx-auto px-5 mt-28 sm:mt-40">
      <p className="text-sm font-medium text-primary">Cine te poate ajuta</p>
      <h2 className="mt-3 font-heading text-3xl sm:text-5xl font-extrabold tracking-[-0.02em] max-w-2xl">
        Trei specialisti, fiecare cu rolul lui.
      </h2>
      <div className="mt-12 border-t border-border">
        {HELPERS.map((h) => (
          <div key={h.title} className="py-9 border-b border-border grid sm:grid-cols-[240px_1fr] gap-3 sm:gap-10">
            <h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">{h.title}</h3>
            <div>
              <p className="text-muted-foreground leading-relaxed max-w-xl">{h.text}</p>
              <p className="mt-3 text-sm text-primary font-medium">{h.examples}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}