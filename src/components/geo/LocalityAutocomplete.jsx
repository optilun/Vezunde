import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";

// Canonical locality selector backed by searchGeographicLocalities (Module 3F.2).
export default function LocalityAutocomplete({
  value,
  onSelect,
  placeholder = "Caută localitatea...",
  className = "",
  variant = "default",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const reqId = useRef(0);
  const [status, setStatus] = useState("idle");
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    setResults([]);
    if (q.length < 2) { setStatus("idle"); return undefined; }
    setStatus("loading");

    const timer = window.setTimeout(() => {
      base44.functions
        .invoke("searchGeographicLocalities", { query: q })
        .then((res) => {
          if (res.data?.error) throw new Error(res.data.error);
          if (reqId.current === id) { setResults(res.data?.results || []); setStatus("ready"); }
        })
        .catch(() => {
          if (reqId.current === id) { setResults([]); setStatus("error"); }
        });
    }, 250);
    return () => { window.clearTimeout(timer); reqId.current += 1; };
  }, [query, retry]);

  if (value) {
    return (
      <div
        className={`flex min-h-12 items-center justify-between ${variant === "compact" ? "rounded-full border border-transparent" : "rounded-xl border border-border"} bg-card pl-4 pr-0.5 text-sm ${className}`}
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
    <div className={`relative ${className}`} onFocus={() => setOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className={`min-h-12 w-full ${variant === "compact" ? "rounded-full border border-transparent" : "rounded-xl border border-border"} bg-card px-4 py-2.5 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm`}
      />
      {open && query.trim().length >= 2 && (status === "loading" || status === "error" || (status === "ready" && results.length === 0)) && <div className="absolute z-40 mt-1 w-full rounded-xl border border-border bg-card p-4 text-sm shadow-lg">
        <p role="status">{status === "loading" ? "Se caută localități..." : status === "error" ? "Nu am putut încărca localitățile." : "Nu am găsit localitatea. Verifică denumirea."}</p>
        {status === "error" && <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 min-h-11 rounded-full border border-border px-4">Reîncearcă</button>}
      </div>}
      {open && results.length > 0 && (
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