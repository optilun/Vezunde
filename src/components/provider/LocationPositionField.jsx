import React, { useState } from "react";
import LocationPinMap from "@/components/maps/LocationPinMap";
import { locationCoordinates, locationPositionLabel } from "../../../shared/locationMapPosition.js";

// The same pin editor is used for a first location and organization expansion.
export default function LocationPositionField({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(() => Boolean(locationCoordinates(value)));
  const point = locationCoordinates(value);
  const confirmed = Boolean(point && value.map_precision === "exact");
  return <div className="rounded-xl border border-border bg-secondary/20 p-3">
    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-semibold"
      aria-expanded={open} onClick={() => setOpen(!open)}>
      Poziție pe hartă <span className="text-xs font-normal text-muted-foreground">{locationPositionLabel(value)} · {open ? "Ascunde" : "Arată"}</span>
    </button>
    {open && <>
      <div className="mt-2 h-60 overflow-hidden rounded-xl border border-border">
        <LocationPinMap location={value} onPositionChange={disabled ? null : ({ lat, lng }) => onChange({ ...value, lat, lng, map_precision: "approximate", place_id: "" })} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">Alege intrarea locației pe hartă. O adresă nouă are nevoie de un pin nou.</p>
        <button type="button" disabled={disabled || !point || !String(value.address || "").trim() || confirmed}
          onClick={() => onChange({ ...value, map_precision: "exact" })}
          className="min-h-11 rounded-full border border-border bg-background px-4 text-xs font-semibold disabled:opacity-40">
          {confirmed ? "Poziție confirmată" : "Confirmă poziția"}
        </button>
      </div>
    </>}
  </div>;
}
