import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Canonical locality selector backed by searchGeographicLocalities (Module 3F.2).
export default function LocalityAutocomplete({
  value,
  onSelect,
  placeholder = "Caută localitatea...",
  className = "",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    setResults([]);
    if (q.length < 2) return undefined;

    const timer = window.setTimeout(() => {
      base44.functions
        .invoke("searchGeographicLocalities", { query: q })
        .then((res) => {
          if (reqId.current === id) setResults(res.data?.results || []);
        })
        .catch(() => {
          if (reqId.current === id) setResults([]);
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  if (value) {
    return (
      <div
        className={`flex min-h-12 items-center justify-between rounded-xl border border-border bg-card pl-4 pr-0.5 text-sm ${className}`}
      >
        <span className="min-w-0 truncate font-medium">
          {value.display_label || value.name}
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Șterge localitatea"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setResults([]);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="min-h-12 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm"
      />
      {results.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-[min(16rem,45dvh)] w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
          {results.map((locality) => (
            <button
              key={locality.siruta_code}
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                onSelect(locality);
              }}
              className="min-h-12 w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary active:bg-secondary"
            >
              {locality.display_label}
              {locality.county_name &&
                !locality.display_label.includes(locality.county_name) && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {locality.county_name}
                  </span>
                )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
