import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Search, BadgeCheck, MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import SimilarLocationCard from "@/components/provider/SimilarLocationCard";

const GooglePlacesResults = lazy(() => import("@/components/provider/GooglePlacesResults"));

export default function ProviderSearch({ onClaim, onNew }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [googleMode, setGoogleMode] = useState(false);
  const [similar, setSimilar] = useState(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const reqId = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await base44.functions.invoke("getClaimableProviderLocations", { q }).catch(() => ({ data: {} }));
      if (reqId !== reqRef.current) return;
      setLoading(false);
      setResults(res.data?.locations || []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const showGoogleTrigger = query.trim().length >= 3 && !loading && results.length === 0;

  if (similar) {
    return (
      <SimilarLocationCard
        location={similar.location}
        onClaim={() => onClaim(similar.location)}
        onContinue={() => onNew(similar.draft)}
        onBack={() => setSimilar(null)}
      />
    );
  }

  return (
    <div className="text-left">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cauta optica, clinica sau cabinetul dupa nume, oras ori adresa"
          className="w-full rounded-xl border border-border bg-card pl-11 pr-4 py-3.5 text-sm outline-none focus:border-foreground/50 transition-colors"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {query.trim().length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Verificam mai intai daca profilul exista deja. Incepe sa scrii pentru a cauta.</p>
      )}

      <div className="mt-4 space-y-3">
        {results.map((loc) => (
          <div key={loc.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[loc.provider_type] || loc.provider_type}</div>
                <div className="font-semibold flex items-center gap-1.5">
                  {loc.name}
                  {loc.profile_control_status === "verified" && <BadgeCheck className="w-4 h-4 text-primary" />}
                </div>
                {loc.organization_name && loc.organization_name !== loc.name && <div className="text-xs text-muted-foreground">{loc.organization_name}</div>}
                <div className="text-sm text-muted-foreground mt-1 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{loc.city}{loc.address ? `, ${loc.address}` : ""}</span>
                </div>
                {loc.status_label && <div className="text-xs mt-1 text-muted-foreground">{loc.status_label}</div>}
              </div>
              <button
                type="button"
                onClick={() => onClaim(loc)}
                className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: "#171717" }}
              >
                {loc.action_label || (loc.claim_action === "request_access" ? "Solicita acces" : "Revendica profilul")}
              </button>
            </div>
          </div>
        ))}
        {query.trim().length >= 2 && !loading && results.length === 0 && !googleMode && (
          <p className="text-sm text-muted-foreground">Nicio locatie gasita in director.</p>
        )}
      </div>

      {showGoogleTrigger && !googleMode && (
        <div className="mt-4">
          <button type="button" onClick={() => setGoogleMode(true)} className="w-full px-5 py-3 rounded-xl border border-dashed border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors">
            Nu o gasesti? Cauta pe Google Maps
          </button>
        </div>
      )}

      {googleMode && (
        <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground">Se incarca...</p>}>
          <GooglePlacesResults query={query} onExisting={onClaim} onSimilar={setSimilar} onDraft={onNew} />
        </Suspense>
      )}

      <div className="mt-6 text-center">
        <button type="button" onClick={() => onNew()} className="px-6 py-3 rounded-lg border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors">
          Adauga o organizatie si prima locatie
        </button>
      </div>
    </div>
  );
}
