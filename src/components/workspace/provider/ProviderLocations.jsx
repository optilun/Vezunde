import React from "react";
import { PROFILE_CONTROL_LABELS } from "@/lib/workspaceStatusLabels";

export default function ProviderLocations({ workspace, selectedLocationId, onSelect }) {
  const locById = Object.fromEntries((workspace.locations || []).map((l) => [l.id, l]));

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Locatii</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        {(workspace.memberships || []).map((m) => {
          const loc = locById[m.location_id];
          if (!loc) return null;
          const active = m.location_id === selectedLocationId;
          return (
            <div key={m.location_id} className={`rounded-xl border p-4 bg-card ${active ? "border-foreground" : "border-border"}`}>
              <div className="font-semibold text-sm">{loc.public_display_name || loc.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{loc.locality_name || loc.city} · {PROFILE_CONTROL_LABELS[loc.profile_control_status] || loc.profile_control_status}</div>
              <div className="text-xs text-muted-foreground mt-1">Completitudine: {m.profile_completeness}%</div>
              {active ? (
                <span className="mt-3 inline-block text-xs font-semibold text-foreground">Locatie selectata</span>
              ) : (
                <button onClick={() => onSelect(m.location_id)} className="mt-3 text-xs font-semibold underline underline-offset-4">Selecteaza</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}