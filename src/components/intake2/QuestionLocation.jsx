import React, { useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function QuestionLocation({ onAnswer }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    if (q.length < 2) {
      setResults(null);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      base44.functions
        .invoke("searchGeographicLocalities", { query: q })
        .then((response) => {
          if (reqId.current === id) setResults(response.data?.results || []);
        })
        .catch(() => {
          if (reqId.current === id) setResults([]);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-3">
        <SearchIcon
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Caută localitatea sau orașul..."
          aria-label="Caută localitatea sau orașul"
          autoComplete="off"
          autoFocus
          className="min-w-0 w-full bg-transparent text-base outline-none placeholder:text-[#9B968D]"
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Selectează localitatea din lista oficială. VIASEE caută mai întâi numai în localitatea aleasă și extinde aria doar dacă soliciți explicit acest lucru.
      </p>
      <div className="mt-3 max-h-[min(16rem,42dvh)] space-y-2 overflow-y-auto overscroll-contain pr-1">
        {results?.map((locality) => (
          <button
            key={locality.siruta_code}
            type="button"
            onClick={() =>
              onAnswer({
                scope: "locality",
                city: locality.name,
                locality,
                clientAddressText: locality.display_label,
              })
            }
            className="min-h-12 w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-foreground/40 active:bg-secondary"
          >
            {locality.display_label}
          </button>
        ))}
        {results !== null && results.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">
            Nicio localitate găsită. Verifică scrierea și încearcă din nou.
          </p>
        )}
        {results === null && query.trim().length < 2 && (
          <p className="py-2 text-sm text-muted-foreground">
            Scrie cel puțin 2 litere pentru a căuta o localitate.
          </p>
        )}
      </div>
    </div>
  );
}
