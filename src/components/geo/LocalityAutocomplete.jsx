import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Canonical locality selector backed by searchGeographicLocalities (Module 3F.2).
export default function LocalityAutocomplete({ value, onSelect, placeholder = "Cauta localitatea...", className = "" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      base44.functions.invoke("searchGeographicLocalities", { query: q })
        .then((res) => { if (reqId.current === id) setResults(res.data?.results || []); })
        .catch(() => { if (reqId.current === id) setResults([]); });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  if (value) {
    return (
      <div className={`flex min-h-12 items-center justify-between rounded-xl border border-border bg-card pl-4 pr-0.5 text-sm ${className}`}>
        <span className="font-medium">{value.display_label || value.name}</span>
        <button type="button" onClick={() => onSelect(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Sterge localitatea">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="min-h-12 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm"
      />
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((loc) => (
            <button
              key={loc.siruta_code}
              type="button"
              onClick={() => { setQuery(""); setResults([]); onSelect(loc); }}
              className="min-h-12 w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              {loc.display_label}
              {loc.county_name && !loc.display_label.includes(loc.county_name) && (
                <span className="text-xs text-muted-foreground ml-2">{loc.county_name}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
