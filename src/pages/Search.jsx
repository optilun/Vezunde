import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICES, PROVIDER_TYPES } from "@/lib/vezunde";
import { getServiceSearchSuggestions } from "@/lib/serviceSemanticSearch";
import { matchProvidersWithSemanticFallback } from "@/lib/providerSemanticSearch";
import ProviderCard from "@/components/ProviderCard";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const SELECT =
  "min-h-12 w-full rounded-xl border border-border bg-card px-4 py-2.5 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm";

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function Search() {
  const [urlParams] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const [results, setResults] = useState(null);
  const [service, setService] = useState(urlParams.get("serviciu") || "");
  const [query, setQuery] = useState(urlParams.get("q") || "");
  const [type, setType] = useState("");
  const initialLocalityName = urlParams.get("oras");
  const initialSirutaCode = urlParams.get("siruta");
  const [locality, setLocality] = useState(
    initialLocalityName && initialSirutaCode
      ? {
          name: initialLocalityName,
          display_label: initialLocalityName,
          county_name: "",
          siruta_code: initialSirutaCode,
        }
      : null,
  );
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  const suggestions = useMemo(
    () => getServiceSearchSuggestions(query, { limit: 6 }),
    [query],
  );
  const hasCanonicalLocality = Boolean(locality?.siruta_code);
  const isDirectoryBrowse = !service && !debouncedQuery && hasCanonicalLocality;
  const isDirectoryBrowseView =
    !service && !query.trim() && hasCanonicalLocality;

  useEffect(() => {
    setResults(null);
  }, [service, query, type, locality?.siruta_code]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!hasCanonicalLocality) {
        if (active) setResults([]);
        return;
      }

      try {
        if (isDirectoryBrowse) {
          const response = await base44.functions.invoke(
            "browseDirectoryProviders",
            {
              locality_siruta_code: locality.siruta_code,
              provider_types: type ? [type] : [],
              limit: 50,
            },
          );
          if (active) setResults(response.data?.results || []);
          return;
        }

        const response = await matchProvidersWithSemanticFallback({
          search_text: service ? "" : debouncedQuery,
          service_keys: service ? [service] : [],
          provider_types: type ? [type] : [],
          locality_siruta_code: locality.siruta_code,
          limit: 50,
        });
        if (active) setResults(response.data?.results || []);
      } catch (_error) {
        if (active) setResults([]);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [
    service,
    debouncedQuery,
    type,
    locality,
    isDirectoryBrowse,
    hasCanonicalLocality,
  ]);

  const chooseSuggestion = (suggestion) => {
    setService(suggestion.service_key);
    setQuery(suggestion.label);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-5 sm:pt-12">
      <div className="max-w-3xl">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Caută furnizori
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Descrie nevoia în cuvintele tale sau alege un serviciu. Rezultatele
          țin cont de serviciul și localitatea selectate.
        </p>
      </div>

      <section
        className="mt-6 rounded-[22px] border border-border bg-card p-3 shadow-sm sm:p-5"
        aria-label="Filtre de căutare"
      >
        <div className="flex items-center gap-2 pb-3 text-xs font-semibold text-muted-foreground sm:hidden">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filtre de
          căutare
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(280px,1.4fr)_1fr_1fr_1fr]">
          <div className="relative min-w-0">
            <SearchIcon
              className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (service) setService("");
              }}
              placeholder="Ex.: mă ustură ochii, ochelari pentru calculator"
              aria-label="Descrie ce cauți"
              autoComplete="off"
              className={`${SELECT} pl-11`}
            />
            {!service && query.trim() && suggestions.length > 0 && (
              <div
                className="absolute z-30 mt-2 max-h-[min(22rem,55vh)] w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
                aria-label="Sugestii de servicii"
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.service_key}
                    type="button"
                    onClick={() => chooseSuggestion(suggestion)}
                    className="block min-h-12 w-full border-b border-border/60 px-4 py-3 text-left last:border-b-0 hover:bg-secondary active:bg-secondary"
                  >
                    <span className="block text-sm font-semibold">
                      {suggestion.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {suggestion.matched_keyword || suggestion.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={service}
            onChange={(event) => {
              setService(event.target.value);
              if (event.target.value) setQuery("");
            }}
            className={SELECT}
            aria-label="Serviciu"
          >
            <option value="">Alege un serviciu</option>
            {Object.entries(SERVICES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={SELECT}
            aria-label="Tip de furnizor"
          >
            <option value="">Toate tipurile</option>
            {Object.entries(PROVIDER_TYPES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <LocalityAutocomplete
            value={locality}
            onSelect={setLocality}
            placeholder="Alege localitatea"
            className="w-full"
          />
        </div>
      </section>

      {!hasCanonicalLocality ? (
        <SelectLocalityNotice />
      ) : isDirectoryBrowseView ? (
        <div className="mt-8">
          <h2 className="font-heading text-lg font-bold sm:text-xl">
            Locații în {locality?.name}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {results === null && <LoadingState />}
            {results?.length === 0 && <EmptyDirectory />}
            {results?.map((location) => (
              <DirectoryResultCard key={location.id} location={location} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {results === null && <LoadingState />}
          {results?.length === 0 && <EmptyMatch locality={locality} />}
          {results?.map((location) => (
            <ProviderCard key={location.id} location={location} />
          ))}
        </div>
      )}
      <p className="pt-8 text-xs text-muted-foreground">
        VIASEE nu oferă diagnostic medical.
      </p>
    </div>
  );
}

function SelectLocalityNotice() {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
      <p className="font-heading font-bold">
        Alege localitatea în care vrei să cauți.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        VIASEE folosește localitatea oficială selectată și nu extinde automat
        căutarea.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground sm:col-span-2"
      role="status"
    >
      Se încarcă rezultatele...
    </div>
  );
}

function EmptyDirectory() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center sm:col-span-2 sm:p-10">
      <p className="font-heading font-bold">
        Nu avem încă profiluri în această localitate.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Poți verifica din nou mai târziu.
      </p>
      <Link
        to="/cerere"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
      >
        Trimite o cerere
      </Link>
    </div>
  );
}

function EmptyMatch({ locality }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center sm:col-span-2 sm:p-10">
      {locality ? (
        <>
          <p className="font-heading font-bold">
            Nu există momentan rezultate pentru această nevoie în localitate.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Poți verifica din nou mai târziu sau poți alege manual altă
            localitate.
          </p>
        </>
      ) : (
        <>
          <p className="font-heading font-bold">
            Nu am găsit profiluri care să corespundă căutării tale.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Încearcă o formulare mai generală sau alege un serviciu din
            sugestii.
          </p>
        </>
      )}
      <Link
        to="/cerere"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
      >
        Trimite o cerere
      </Link>
    </div>
  );
}
