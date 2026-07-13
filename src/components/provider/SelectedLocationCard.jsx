import React from "react";
import { MapPin } from "lucide-react";
import { PROVIDER_TYPES } from "@/lib/vezunde";

// Shown when a location was already selected before entering the claim wizard
// (e.g. from the "Pentru specialisti" hero search) — skips re-searching.
export default function SelectedLocationCard({ location, onContinue, onChangeLocation }) {
  return (
    <div className="text-left">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
        <div className="font-heading font-bold text-lg mt-0.5">{location.name}</div>
        <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {location.city}{location.address ? `, ${location.address}` : ""}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onContinue}
          className="w-full px-6 py-3 rounded-full text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: "#171717" }}
        >
          Continua
        </button>
        <button
          type="button"
          onClick={onChangeLocation}
          className="w-full px-6 py-3 rounded-full border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Schimba locatia
        </button>
      </div>
    </div>
  );
}