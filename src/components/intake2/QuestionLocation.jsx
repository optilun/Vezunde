import React, { useEffect, useRef, useState } from "react";
import { AlertCircle, Building2, Globe, Loader2, LocateFixed, MapPin, SearchIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";

const OPTION_CLASS = "w-full flex items-center gap-3 text-left rounded-2xl border px-5 py-4 transition-all border-border bg-card hover:border-foreground/40";

export default function QuestionLocation({ onAnswer }) {
  const [mode, setMode] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const reqId = useRef(0);

  useEffect(() => {
    if (mode !== "city") return;
    const q = query.trim();
    if (q.length < 2) { setResults(null); return; }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      base44.functions.invoke("searchGeographicLocalities", { query: q })
        .then((res) => { if (reqId.current === id) setResults(res.data?.results || []); })
        .catch(() => { if (reqId.current === id) setResults([]); });
    }, 250);
    return () => clearTimeout(t);
  }, [query, mode]);

  const useCurrentLocation = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Browserul nu permite folosirea locatiei curente. Cauta manual localitatea.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        onAnswer({
          scope: "nearby",
          city: "",
          locality: null,
          clientLocation: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy || null,
            source: "browser_geolocation",
          },
          clientAddressText: "Locatia curenta",
        });
      },
      () => {
        setGeoLoading(false);
        setGeoError("Nu am primit permisiunea pentru locatie. Poti cauta manual localitatea.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  if (mode === "city") {
    return (
      <div className="mt-6">
        <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-2xl px-4 py-3">
          <SearchIcon className="w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cauta localitatea sau orasul..."
            autoFocus
            className="w-full bg-transparent outline-none text-base placeholder:text-[#9B968D]"
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Pentru adresa exacta, foloseste optiunea „Foloseste locatia mea”. Cautarea manuala foloseste localitatea selectata.
        </p>
        <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
          {results?.map((loc) => (
            <button
              key={loc.siruta_code}
              type="button"
              onClick={() => onAnswer({ scope: "city", city: loc.name, locality: loc, clientAddressText: loc.display_label })}
              className="w-full text-left rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:border-foreground/40 transition-colors"
            >
              {loc.display_label}
            </button>
          ))}
          {results !== null && results.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">Nicio localitate gasita. Verifica scrierea sau alege "Oriunde in Romania".</p>
          )}
          {results === null && query.trim().length < 2 && (
            <p className="text-sm text-muted-foreground py-2">Scrie cel putin 2 litere pentru a cauta o localitate.</p>
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
      <button type="button" onClick={useCurrentLocation} disabled={geoLoading} className={`${OPTION_CLASS} ${geoLoading ? "opacity-70" : ""}`}>
        {geoLoading ? <Loader2 className="w-5 h-5 text-muted-foreground shrink-0 animate-spin" /> : <LocateFixed className="w-5 h-5 text-muted-foreground shrink-0" />}
        <span>
          <span className="block font-medium text-sm">Foloseste locatia mea</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Cautam locatii aflate in perimetrul tau.</span>
        </span>
      </button>
      {geoError && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {geoError}
        </div>
      )}
      <button type="button" onClick={() => setMode("city")} className={OPTION_CLASS}>
        <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
        <span>
          <span className="block font-medium text-sm">Caut intr-o localitate</span>
          <span className="block text-xs text-muted-foreground mt-0.5">Folosim orasul/localitatea aleasa ca reper.</span>
        </span>
      </button>
      <button type="button" onClick={() => onAnswer({ scope: "national" })} className={OPTION_CLASS}>
        <Globe className="w-5 h-5 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm">Oriunde in Romania</span>
      </button>
    </div>
  );
}
