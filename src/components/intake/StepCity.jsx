import React, { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { INTAKE_CITIES } from "@/lib/intake";

export default function StepCity({ data, update, onNext }) {
  const [query, setQuery] = useState("");
  const filtered = INTAKE_CITIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cauta orasul..."
          className="w-full bg-card border border-border rounded-2xl py-3.5 pl-11 pr-4 text-base outline-none focus:border-foreground/40 transition-colors"
        />
      </div>
      <div className="mt-4 space-y-2">
        {filtered.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => { update({ city }); onNext(); }}
            className={`w-full text-left rounded-xl border px-4 py-3.5 flex items-center gap-3 transition-all ${
              data.city === city
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/40"
            }`}
          >
            <MapPin className="w-4 h-4 opacity-60" />
            <span className="font-medium">{city}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground px-1 py-3">
            Momentan Vezunde este disponibil in Sibiu, Cluj-Napoca, Timisoara si Bucuresti.
          </p>
        )}
      </div>
    </div>
  );
}