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
      <div className={`flex items-center justify-between bg-card border border-border rounded-xl px-4 py-2.5 text-sm ${className}`}>
        <span className="font-medium">{value.display_label || value.name}</span>
        <button type="button" onClick={() => onSelect(null)} className="text-muted-foreground hover:text-foreground" aria-label="Sterge localitatea">
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
        className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors"
      />
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {results.map((loc) => (
            <button
              key={loc.siruta_code}
              type="button"
              onClick={() => { setQuery(""); setResults([]); onSelect(loc); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
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