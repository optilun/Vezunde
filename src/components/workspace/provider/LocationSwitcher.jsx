import React from "react";

export default function LocationSwitcher({ memberships, selectedLocationId, onSelect }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {memberships.map((m) => (
        <button
          key={m.location_id}
          onClick={() => onSelect(m.location_id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${m.location_id === selectedLocationId ? "bg-foreground text-white border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"}`}
        >
          {m.location_name}
        </button>
      ))}
    </div>
  );
}