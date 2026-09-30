import React from "react";
import MatchResultCard from "./MatchResultCard";
import { resultGridClassName } from "@/components/results/resultGridClasses";

// 2026-09-30. Recomandarile stau in aceeasi grila ca rezultatele de pe /cauta (resultGridClasses):
// o coloana langa harta pe ecrane late, doua altfel. Grupurile pe localitate / judet raman, fiecare
// cu grila lui. Aici nu se schimba ordinea, sectiunile sau ce se afiseaza - doar asezarea.
export default function ResultScopeGroups({ items, queryScope, selectedCity, countyName, onSelectLocation, selectedId, onHoverLocation = null, hoveredId = null, mappedLocationIds = null }) {
  const hasPositions = Boolean(mappedLocationIds && mappedLocationIds.size > 0);
  const cards = (rows) => (
    <div className={resultGridClassName(hasPositions)}>
      {rows.map((location) => (
        <MatchResultCard
          key={location.id}
          location={location}
          hasMapPoint={mappedLocationIds ? mappedLocationIds.has(location.id) : undefined}
          gridHasMap={hasPositions}
          onSelect={onSelectLocation}
          selected={selectedId === location.id}
          onHover={onHoverLocation}
          hovered={hoveredId === location.id}
        />
      ))}
    </div>
  );

  if (queryScope !== "county") return cards(items);

  const local = items.filter((item) => item.expansion_tier === "oras");
  const county = items.filter((item) => item.expansion_tier === "judet");
  const other = items.filter((item) => !["oras", "judet"].includes(item.expansion_tier));

  return (
    <div className="space-y-6">
      {local.length > 0 && (
        <section>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
            În {selectedCity || "localitatea selectată"}
          </div>
          {cards(local)}
        </section>
      )}
      {county.length > 0 && (
        <section>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
            În restul județului {countyName || "selectat"}
          </div>
          {cards(county)}
        </section>
      )}
      {other.length > 0 && cards(other)}
    </div>
  );
}
