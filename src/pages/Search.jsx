import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { SERVICES, PROVIDER_TYPES } from "@/lib/vezunde";
import { getServiceSearchSuggestions } from "@/lib/serviceSemanticSearch";
import { matchProvidersWithSemanticFallback } from "@/lib/providerSemanticSearch";
import ProviderCard from "@/components/ProviderCard";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const SELECT = "bg-card border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 transition-colors";

export default function Search() {
  const urlParams = new URLSearchParams(window.location.search);
  const [results, setResults] = useState(null);
  const [service, setService] = useState(urlParams.get("serviciu") || "");
  const [query, setQuery] = useState(urlParams.get("q") || "");
  const [type, setType] = useState("");
  const initialLocality = urlParams.get("oras");
  const [locality, setLocality] = useState(initialLocality ? {
    name: initialLocality,
    display_label: initialLocality,
    county_name: "",
    siruta_code: "",
  } : null);

  const suggestions = useMemo(
    () => getServiceSearchSuggestions(query, { limit: 6 }),
    [query],
  );
  const isDirectoryBrowse = !service && !query.trim() && !!locality;

  useEffect(() => {
    let active = true;
    setResults(null);
    const run = async () => {
      try {
        if (isDirectoryBrowse) {
          const response = await base44.functions.invoke("browseDirectoryProviders", {
            locality_siruta_code: locality?.siruta_code || "",
            city: locality?.name || "",
            provider_types: type ? [type] : [],
            limit: 50,
          });
          if (active) setResults(response.data?.results || []);
          return;
        }

        const response = await matchProvidersWithSemanticFallback({
          search_text: query,
          service_keys: service ? [service] : [],
          provider_types: type ? [type] : [],
          city: locality?.name || "",
          county: locality?.county_name || "",
          locality_siruta_code: locality?.siruta_code || "",
          scope: locality ? "city" : "national",
          limit: 50,
        });
        if (active) setResults(response.data?.results || []);
      } catch (_error) {
        // The patient sees the standard empty state, never a backend implementation error.
        if (active) setResults([]);
      }
    };
    run();
    return () => { active = false; };
  }, [service, query, type, locality, isDirectoryBrowse]);

  const chooseSuggestion = (suggestion) => {
    setService(suggestion.service_key);
    setQuery(suggestion.label);
  };

  return (
    <div className="max-w-6xl mx-auto px-5 pt-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Caută furnizori</h1>
      <p className="mt-2 text-sm text-muted-foreground">Descrie nevoia în cuvintele tale sau alege un serviciu. Rezultatele păstrează verificările medicale și de disponibilitate.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-[260px] flex-1">
          <input value={query} onChange={(event) => { setQuery(event.target.value); if (service) setService(""); }} placeholder="Ex.: mă ustură ochii, ochelari calculator, Stellest" className={`${SELECT} w-full`} />
          {query.trim() && suggestions.length > 0 && (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {suggestions.map((suggestion) => (
                <button key={suggestion.service_key} type="button" onClick={() => chooseSuggestion(suggestion)} className="block w-full border-b border-border/60 px-4 py-3 text-left last:border-b-0 hover:bg-secondary">
                  <span className="block text-sm font-semibold">{suggestion.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{suggestion.matched_keyword || suggestion.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <select value={service} onChange={(event) => { setService(event.target.value); if (event.target.value) setQuery(""); }} className={SELECT}>
          <option value="">Alege un serviciu</option>
          {Object.entries(SERVICES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)} className={SELECT}>
          <option value="">Toate tipurile</option>
          {Object.entries(PROVIDER_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <LocalityAutocomplete value={locality} onSelect={setLocality} placeholder="Toată România — caută o localitate" className="w-64" />
      </div>
      {isDirectoryBrowse ? (
        <div className="mt-8 pb-8">
          <h2 className="font-heading text-lg font-bold">Locații în {locality?.name}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {results === null && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
            {results?.length === 0 && <EmptyDirectory />}
            {results?.map((location) => <DirectoryResultCard key={location.id} location={location} />)}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 pb-8 sm:grid-cols-2">
          {results === null && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
          {results?.length === 0 && <EmptyMatch locality={locality} />}
          {results?.map((location) => <ProviderCard key={location.id} location={location} />)}
        </div>
      )}
      <p className="pb-10 text-xs text-muted-foreground">Vezunde nu oferă diagnostic medical.</p>
    </div>
  );
}

function EmptyDirectory() {
  return <div className="sm:col-span-2 rounded-2xl border border-border bg-card p-10 text-center"><p className="font-heading font-bold">Nu avem încă profiluri în această localitate.</p><p className="mt-2 text-sm text-muted-foreground">Poți verifica din nou mai târziu.</p><Link to="/cerere" className="mt-5 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">Trimite o cerere</Link></div>;
}

function EmptyMatch({ locality }) {
  return <div className="sm:col-span-2 rounded-2xl border border-border bg-card p-10 text-center">{locality ? <><p className="font-heading font-bold">Nu există momentan locații cu servicii confirmate pentru această nevoie în localitate.</p><p className="mt-2 text-sm text-muted-foreground">Poți extinde căutarea sau verifica din nou mai târziu.</p></> : <><p className="font-heading font-bold">Nu am găsit profiluri care să corespundă căutării tale.</p><p className="mt-2 text-sm text-muted-foreground">Încearcă o formulare mai generală sau alege un serviciu din sugestii.</p></>}<Link to="/cerere" className="mt-5 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90">Trimite o cerere</Link></div>;
}
