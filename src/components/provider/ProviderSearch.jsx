import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Search, BadgeCheck, MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import SimilarLocationCard from "@/components/provider/SimilarLocationCard";

const GooglePlacesResults = lazy(() => import("@/components/provider/GooglePlacesResults"));

const PENDING_KEY = "pending_claim_location";

// Module 3E.2.1: unauthenticated specialists can SEARCH via the public whitelist
// lookup; login is required only when they choose to claim a location.
export default function ProviderSearch({ onClaim, onNew }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [googleMode, setGoogleMode] = useState(false);
  const [similar, setSimilar] = useState(null);
  const reqRef = useRef(0);

  // After login, resume a claim started before authentication.
  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    base44.auth.isAuthenticated().then((ok) => {
      if (!ok) return;
      sessionStorage.removeItem(PENDING_KEY);
      try { onClaim(JSON.parse(raw)); } catch (_e) { /* ignore corrupt state */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const reqId = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await base44.functions
        .invoke("getClaimableProviderLocations", { q })
        .catch(() => ({ data: {} }));
      if (reqId !== reqRef.current) return;
      setLoading(false);
      setResults(res.data?.locations || []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleClaim = async (loc) => {
    const ok = await base44.auth.isAuthenticated();
    if (ok) { onClaim(loc); return; }
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(loc));
    base44.auth.redirectToLogin(window.location.href);
  };

  // Google fallback only when Vezunde search has 0 results and query >= 3 chars.
  const showGoogleTrigger = query.trim().length >= 3 && !loading && results.length === 0;

  if (similar) {
    return (
      <SimilarLocationCard
        location={similar.location}
        onClaim={() => handleClaim(similar.location)}
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
          placeholder="Cauta dupa nume, organizatie, oras sau adresa"
          className="w-full rounded-xl border border-border bg-card pl-11 pr-4 py-3.5 text-sm outline-none focus:border-foreground/50 transition-colors"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      {query.trim().length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Verificam mai intai daca profilul exista deja. Incepe sa scrii pentru a cauta.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {results.map((loc) => (
          <div key={loc.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[loc.provider_type] || loc.provider_type}</div>
                <div className="font-semibold flex items-center gap-1.5">
                  {loc.name}
                  {loc.status_label === "Verificat de Vezunde" && <BadgeCheck className="w-4 h-4 text-primary" />}
                </div>
                {loc.organization_name && (
                  <div className="text-xs text-muted-foreground">{loc.organization_name}</div>
                )}
                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {loc.city}{loc.address ? `, ${loc.address}` : ""}
                </div>
                {loc.status_label && (
                  <div className="text-xs mt-1 text-muted-foreground">{loc.status_label}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleClaim(loc)}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold text-white transition-colors"
                style={{ backgroundColor: "#171717" }}
              >
                Aceasta este locatia mea
              </button>
            </div>
          </div>
        ))}
        {query.trim().length >= 2 && !loading && results.length === 0 && !googleMode && (
          <p className="text-sm text-muted-foreground">Nicio locatie gasita.</p>
        )}
      </div>

      {showGoogleTrigger && !googleMode && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setGoogleMode(true)}
            className="w-full px-5 py-3 rounded-xl border border-dashed border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors"
          >
            Nu gasesti locatia? Cauta pe Google Maps
          </button>
        </div>
      )}

      {googleMode && (
        <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground">Se incarca...</p>}>
          <GooglePlacesResults
            query={query}
            onExisting={handleClaim}
            onSimilar={setSimilar}
            onDraft={onNew}
          />
        </Suspense>
      )}

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => onNew()}
          className="px-6 py-3 rounded-full border border-border bg-card text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Nu gasesc locatia
        </button>
      </div>
    </div>
  );
}