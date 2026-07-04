import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ChoiceCard from "@/components/intake/ChoiceCard";

export default function OnbMode({ data, update, onNext }) {
  const [locations, setLocations] = useState([]);

  useEffect(() => {
    if (data.mode === "claim") {
      base44.entities.ProviderLocation.list(null, 100).then(setLocations);
    }
  }, [data.mode]);

  return (
    <div className="space-y-3">
      <ChoiceCard
        label="Revendica o locatie existenta"
        hint="Locatia apare deja pe Vezunde"
        selected={data.mode === "claim"}
        onClick={() => update({ mode: "claim", claimLocation: null })}
      />
      <ChoiceCard
        label="Adauga o locatie noua"
        hint="Locatia nu exista inca pe platforma"
        selected={data.mode === "new"}
        onClick={() => { update({ mode: "new", claimLocation: null }); onNext("new"); }}
      />
      {data.mode === "claim" && (
        <div className="pt-3">
          <div className="text-sm font-semibold mb-2">Alege locatia ta</div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  update({
                    claimLocation: loc,
                    name: loc.name,
                    provider_type: loc.provider_type,
                    city: loc.city,
                    address: loc.address || "",
                    phone: loc.phone_public || "",
                    opening_hours: loc.opening_hours || "",
                  });
                  onNext("claim");
                }}
                className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 hover:border-foreground/40 transition-colors"
              >
                <div className="font-medium text-sm">{loc.name}</div>
                <div className="text-xs text-muted-foreground">{loc.city}</div>
              </button>
            ))}
            {locations.length === 0 && <p className="text-sm text-muted-foreground py-2">Se incarca locatiile...</p>}
          </div>
        </div>
      )}
    </div>
  );
}