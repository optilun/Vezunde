import React, { useEffect, useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
import { searchLocations } from "@/lib/locationSearch";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function LocationSearch({ onSelect, onManual }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchLocations(query).then((r) => {
        setResults(r);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div>
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex.: Optica Vedere Clara Sibiu sau 0269..."
          className="w-full bg-card border border-border rounded-2xl py-4 pl-12 pr-4 text-base outline-none focus:border-foreground/40 transition-colors shadow-sm"
          autoFocus
        />
      </div>

      <div className="mt-4 space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Cautam...
          </div>
        )}
        {!loading && results.map((loc) => (
          <div key={loc.id} className="bg-card border border-border rounded-2xl p-5">
            <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[loc.provider_type] || ""}</div>
            <div className="mt-0.5 font-heading font-bold tracking-tight">{loc.name}</div>
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {[loc.address, loc.city].filter(Boolean).join(", ")}
            </div>
            <button
              type="button"
              onClick={() => onSelect(loc)}
              className="mt-4 px-5 py-2.5 rounded-full text-white text-sm font-medium transition-colors"
              style={{ backgroundColor: "#171717" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2B2B2B"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#171717"; }}
            >
              Aceasta este locatia mea
            </button>
          </div>
        ))}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">Niciun rezultat pentru cautarea ta.</p>
        )}
      </div>

      <button
        type="button"
        onClick={onManual}
        className="mt-6 text-sm font-semibold underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
      >
        Nu gasesc locatia
      </button>
    </div>
  );
}