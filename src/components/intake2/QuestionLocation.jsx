import React, { useEffect, useState } from "react";
import { MapPin, Building2, Globe, SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";

const OPTION_CLASS = "w-full flex items-center gap-3 text-left rounded-2xl border px-5 py-4 transition-all border-border bg-card hover:border-foreground/40";

export default function QuestionLocation({ onAnswer }) {
  const [mode, setMode] = useState(null);
  const [cities, setCities] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (mode !== "city" || cities !== null) return;
    // Modul 3E.1: orasele vin printr-o functie publica whitelist, nu prin citire directa de entitati.
    base44.functions.invoke("getPublicLocationsForSearch", {})
      .then((res) => setCities(res.data?.cities || []))
      .catch(() => setCities([]));
  }, [mode, cities]);

  if (mode === "city") {
    const filtered = (cities || []).filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()));
    return (
      <div className="mt-6">
        <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-2xl px-4 py-3">
          <SearchIcon className="w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cauta orasul..."
            autoFocus
            className="w-full bg-transparent outline-none text-base placeholder:text-[#9B968D]"
          />
        </div>
        <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
          {cities === null && <p className="text-sm text-muted-foreground py-2">Se incarca orasele...</p>}
          {filtered.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => onAnswer({ scope: "city", city })}
              className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:border-foreground/40 transition-colors"
            >
              {city}
            </button>
          ))}
          {cities !== null && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Nu avem inca furnizori in acest oras. Poti alege "Oriunde in Romania".
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onAnswer({ scope: "national" })}
          className="mt-4 text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          Oriunde in Romania
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-2.5">
      <button type="button" disabled className={`${OPTION_CLASS} opacity-50 cursor-not-allowed`}>
        <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
        <span>
          <span className="block font-medium text-sm">Foloseste locatia mea</span>
          <span className="block text-xs text-muted-foreground mt-0.5">In curand</span>
        </span>
      </button>
      <button type="button" onClick={() => setMode("city")} className={OPTION_CLASS}>
        <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm">Caut intr-un oras</span>
      </button>
      <button type="button" onClick={() => onAnswer({ scope: "national" })} className={OPTION_CLASS}>
        <Globe className="w-5 h-5 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm">Oriunde in Romania</span>
      </button>
    </div>
  );
}