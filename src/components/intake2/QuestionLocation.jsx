import React, { useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function QuestionLocation({ onAnswer }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }

    const id = ++reqId.current;
    const timer = setTimeout(() => {
      base44.functions.invoke("searchGeographicLocalities", { query: q })
        .then((response) => {
          if (reqId.current === id) setResults(response.data?.results || []);
        })
        .catch(() => {
          if (reqId.current === id) setResults([]);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-3">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cauta localitatea sau orasul..."
          autoFocus
          className="w-full bg-transparent text-base outline-none placeholder:text-[#9B968D]"
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Selecteaza localitatea din lista oficiala. VIASEE cauta numai locatii din localitatea aleasa.
      </p>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {results?.map((locality) => (
          <button
            key={locality.siruta_code}
            type="button"
            onClick={() => onAnswer({
              scope: "locality",
              city: locality.name,
              locality,
              clientAddressText: locality.display_label,
            })}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-left text-sm font-medium transition-colors hover:border-foreground/40"
          >
            {locality.display_label}
          </button>
        ))}
        {results !== null && results.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">
            Nicio localitate gasita. Verifica scrierea si incearca din nou.
          </p>
        )}
        {results === null && query.trim().length < 2 && (
          <p className="py-2 text-sm text-muted-foreground">
            Scrie cel putin 2 litere pentru a cauta o localitate.
          </p>
        )}
      </div>
    </div>
  );
}
