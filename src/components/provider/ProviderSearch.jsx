import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Search, BadgeCheck, MapPin, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES } from "@/lib/vezunde";
import SimilarLocationCard from "@/components/provider/SimilarLocationCard";
import OrganizationSearchResult from "@/components/provider/OrganizationSearchResult";

const GooglePlacesResults = lazy(() => import("@/components/provider/GooglePlacesResults"));

export default function ProviderSearch({ onClaim, onNew }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [googleMode, setGoogleMode] = useState(false);
  const [similar, setSimilar] = useState(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setOrganizations([]); return; }
    const reqId = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await base44.functions.invoke("getClaimableProviderLocations", { q }).catch(() => ({ data: {} }));
      if (reqId !== reqRef.current) return;
      setLoading(false);
      setResults(res.data?.locations || []);
      setOrganizations(res.data?.organizations || []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleClaim = (location, options) => onClaim(location, options);
  const showGoogleTrigger = query.trim().length >= 3 && !loading && results.length === 0 && organizations.length === 0;

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
    <div className="min-w-0 text-left">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cauta dupa nume, oras sau adresa"
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-12 w-full rounded-xl border border-border bg-card py-3.5 pl-11 pr-11 text-base outline-none transition-colors focus:border-foreground/50 sm:text-sm"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {query.trim().length === 0 && (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Verificam mai intai daca profilul exista deja. Incepe sa scrii pentru a cauta.</p>
      )}

      <div className="mt-4 space-y-3">
        {organizations.map((organization) => (
          <OrganizationSearchResult
            key={organization.id}
            organization={organization}
            onClaimOrganization={(org) => {
              const primary = org.locations.find((item) => item.id === org.primary_location_id) || org.locations[0];
              if (primary) handleClaim(primary, { preferredScope: "organization" });
            }}
            onClaimLocation={(location) => handleClaim(location)}
          />
        ))}
        {results.map((location) => {
          const requestsAccess = location.claim_action === "request_access";
          return (
            <div key={location.id} className="rounded-2xl border border-border bg-card p-4 sm:rounded-xl">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{PROVIDER_TYPES[location.provider_type] || location.provider_type}</div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 font-semibold leading-snug">
                  <span className="min-w-0 break-words">{location.name}</span>
                  {location.profile_control_status === "verified" && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                {location.organization_name && <div className="mt-0.5 break-words text-xs text-muted-foreground">{location.organization_name}</div>}
                <div className="mt-2 flex items-start gap-1.5 text-sm leading-5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">{location.city}{location.address ? `, ${location.address}` : ""}</span>
                </div>
                <div className="mt-2 text-xs leading-5 text-muted-foreground">
                  {requestsAccess ? "Profil administrat. Solicitarea va fi verificata inainte de acordarea accesului." : "Profil disponibil pentru revendicare."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleClaim(location)}
                className="mt-4 min-h-11 w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:w-auto sm:rounded-full sm:text-xs"
              >
                {requestsAccess ? "Solicita acces" : "Aceasta este locatia mea"}
              </button>
            </div>
          );
        })}
        {query.trim().length >= 2 && !loading && results.length === 0 && organizations.length === 0 && !googleMode && <p className="text-sm text-muted-foreground">Nicio locatie gasita.</p>}
      </div>

      {showGoogleTrigger && !googleMode && (
        <div className="mt-4">
          <button type="button" onClick={() => setGoogleMode(true)} className="min-h-12 w-full rounded-xl border border-dashed border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-foreground/40">
            Nu gasesti locatia? Cauta pe Google Maps
          </button>
        </div>
      )}

      {googleMode && (
        <Suspense fallback={<p className="mt-4 text-sm text-muted-foreground">Se incarca...</p>}>
          <GooglePlacesResults query={query} onExisting={handleClaim} onSimilar={setSimilar} onDraft={onNew} />
        </Suspense>
      )}

      <div className="mt-6">
        <button type="button" onClick={() => onNew()} className="min-h-12 w-full rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold transition-colors hover:border-foreground/40 sm:w-auto sm:rounded-full">
          Nu gasesc locatia
        </button>
      </div>
    </div>
  );
}