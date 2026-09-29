import React from "react";
import { shortTypeLabel } from "../../../shared/resultsMapLabels.js";
import { requestMapCardFocus } from "@/lib/mapCardFocus";

// 2026-09-29 (audit /cauta, D1): lista locatiilor dintr-un grup de pe harta. Era scrisa de doua ori
// (harta vectoriala si harta 2D), identic; acum ambele folosesc acest component.
export default function MapClusterList({ cluster, onClose, onSelect }) {
  if (!cluster) return null;
  const choose = (id) => {
    onClose();
    requestMapCardFocus();
    if (onSelect) onSelect(id);
  };
  return (
    <section aria-label="Locații din grup"
      className="absolute inset-x-3 bottom-3 z-[500] max-h-[60%] overflow-y-auto rounded-2xl border border-border bg-card p-3.5 shadow-lg sm:inset-x-auto sm:left-3 sm:w-80">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{cluster.count} locații în acest grup</h2>
        <button type="button" aria-label="Închide lista locațiilor" onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-secondary">×</button>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">Mai multe profiluri sunt grupate pe hartă. Coordonatele pot fi aproximative; verifică adresa fiecăruia.</p>
      <ul className="divide-y divide-border">
        {cluster.points.map((point) => (
          <li key={point.id}>
            <button type="button" onClick={() => choose(point.id)}
              className="min-h-11 w-full rounded-lg px-2 py-3 text-left hover:bg-secondary focus-visible:outline focus-visible:outline-2">
              <span className="block text-sm font-semibold">{point.name}</span>
              <span className="block text-xs text-muted-foreground">{shortTypeLabel(point.provider_type)}{point.address ? ` · ${point.address}` : ""}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
