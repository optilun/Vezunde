import React, { useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import InfoHint from "./InfoHint";
import ChoiceCard from "@/components/intake/ChoiceCard";

// 2026-09-27: regula de cautare (aprobata) se deschide cu butonul "i" din campul de cautare, ca
// sa nu ocupe cardul. Formularea ramane aceeasi.
const LOCATION_RULE = "Selectează localitatea din lista oficială. VIASEE caută mai întâi numai în localitatea aleasă și extinde aria doar dacă soliciți explicit acest lucru.";

// 2026-09-24: cand pacientul a scris deja orasul ("...in Cluj"), campul porneste completat si
// lista oficiala apare imediat. Selectia ramane explicita: nu alegem noi localitatea.
export default function QuestionLocation({ onAnswer, initialQuery = "" }) {
  const prefilled = String(initialQuery || "").trim().slice(0, 80);
  const [query, setQuery] = useState(prefilled);
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
        <InfoHint items={[LOCATION_RULE]} label="Cum căutăm localitatea" className="-my-1 -mr-2" />
      </div>
      {prefilled && query.trim() === prefilled && (
        <p className="mt-2 text-xs font-medium leading-relaxed text-foreground/80">
          Am căutat după localitatea din mesajul tău.
        </p>
      )}
      <div className="mt-3 max-h-[min(16rem,42dvh)] space-y-2 overflow-y-auto overscroll-contain pr-1">
        {/* 2026-09-27: acelasi card ca la celelalte intrebari (varianta compacta). */}
        {results?.map((locality) => (
          <ChoiceCard
            key={locality.siruta_code}
            compact
            label={locality.display_label}
            onClick={() =>
              onAnswer({
                scope: "locality",
                city: locality.name,
                locality,
                clientAddressText: locality.display_label,
              })
            }
          />
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
