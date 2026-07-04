import React from "react";
import { CSV_TEMPLATE_FIELDS } from "@/lib/researchCatalog";

// PART 7 - CSV preparation ONLY. No import functionality exists in this module.
export default function ResearchCsvTemplate() {
  const download = () => {
    const header = CSV_TEMPLATE_FIELDS.map((f) => f.key).join(",");
    const blob = new Blob([header + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vezunde_directory_research_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-heading font-bold">Sablon CSV pentru research</h3>
          <p className="text-sm text-muted-foreground mt-1">Descarca sablonul gol pentru colectarea datelor din surse publice oficiale. Acest modul NU importa date.</p>
        </div>
        <button onClick={download} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold shrink-0">Descarca sablon CSV</button>
      </div>

      <div className="mt-6 bg-card border border-border rounded-xl p-5">
        <h4 className="font-heading font-bold text-sm">Documentatia campurilor</h4>
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 pr-3">Camp</th>
              <th className="py-2 pr-3">Obligatoriu</th>
              <th className="py-2">Descriere</th>
            </tr>
          </thead>
          <tbody>
            {CSV_TEMPLATE_FIELDS.map((f) => (
              <tr key={f.key} className="border-b border-border/60">
                <td className="py-2 pr-3 font-mono">{f.key}</td>
                <td className="py-2 pr-3">{f.required ? "Da" : "Nu"}</td>
                <td className="py-2 text-muted-foreground">{f.doc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 bg-secondary/40 border border-dashed border-border rounded-xl p-5 text-sm">
        <h4 className="font-heading font-bold text-sm">Reguli pentru viitorul import (nu este implementat acum)</h4>
        <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Fiecare rand necesita un source_url explicit si data verificarii sursei.</li>
          <li>Sursele Google Maps / Google Places nu sunt acceptate.</li>
          <li>Tip furnizor, oras si nume locatie sunt obligatorii.</li>
          <li>Fiecare rand trece prin verificare de duplicate inainte de scriere.</li>
          <li>Previzualizare de validare: randurile invalide sunt afisate si respinse inainte de orice scriere.</li>
          <li>Nicio scriere fara confirmare manuala explicita, rand cu rand sau pe lot revizuit.</li>
          <li>Importul automat este interzis — datele intra doar prin actiuni de admin autentificate.</li>
        </ul>
      </div>
    </div>
  );
}