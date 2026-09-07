import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICES } from "@/lib/vezunde";
import { getServiceSearchSuggestions } from "@/lib/serviceSemanticSearch";
import { matchProvidersWithSemanticFallback } from "@/lib/providerSemanticSearch";
import { deterministicSafetyFlagsFromText } from "@/lib/patientSafety";
import UrgencyInterruption from "@/components/intake2/UrgencyInterruption";
import ProviderCard from "@/components/ProviderCard";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";
import ProfessionalDirectoryCard from "@/components/results/ProfessionalDirectoryCard";
import ResultModeTabs, { RESULT_MODES } from "@/components/intake2/ResultModeTabs";
import LocationsWithMap from "@/components/results/LocationsWithMap";
import DirectoryMap from "@/pages/DirectoryMap";
import { browsePublicProfessionals, matchProfessionalsForRequest } from "@/lib/professionalSearch";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

import { readSearchSession, writeSearchSession } from "@/lib/searchSession";

const SEARCH_INPUT =
  "min-h-12 w-full rounded-full border border-transparent bg-card px-4 py-2.5 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm";

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Lista de locatii alaturi de harta lor. Aceeasi idee ca pe ecranul de recomandari: cardurile
// spun CARE sunt optiunile, harta spune UNDE sunt, iar selectia merge in ambele sensuri.
// Pe telefon nu incap alaturi, deci se comuta intre ele.
//
// Cand niciun rezultat nu are inca pozitie publicata, harta nu se afiseaza deloc si lista ramane
// pe doua coloane, ca inainte - o coloana goala langa carduri nu ajuta pe nimeni.

export default function Search() {
  const [urlParams] = useState(
    () => new URLSearchParams(window.location.search),
  );
  const [saved] = useState(() => {
    const previous = readSearchSession();
    return !window.location.search || previous.sourceSearch === window.location.search ? previous : {};
  });
  const [results, setResults] = useState(null);
  const [matchContext, setMatchContext] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [professionalError, setProfessionalError] = useState(false);
  const [retry, setRetry] = useState(0);
  const restoredScroll = useRef(false);
  // 2026-09-03: /cauta rasfoia doar locatii. Pacientul care stie ca vrea "un oftalmolog din Sibiu"
  // nu avea de unde sa inceapa - trebuia sa deschida clinici una cate una si sa se uite la echipa.
  // Acelasi selector ca in rezultatele cererii, ca sa fie evident ca e aceeasi idee.
  const [searchMode, setSearchMode] = useState(saved.searchMode || RESULT_MODES.locations.key);
  // 2026-09-06: aceeasi harta ca pe ecranul de recomandari, ca rasfoirea unei localitati sa arate
  // si UNDE sunt locatiile, nu doar care sunt. Selectia si evidentierea merg in ambele sensuri.
  const [selectedId, setSelectedId] = useState(saved.selectedId || null);
  const [hoveredId, setHoveredId] = useState(null);
  const [mobileView, setMobileView] = useState(saved.mobileView || "list");
  const [professionals, setProfessionals] = useState(null);
  const [service, setService] = useState(saved.service ?? urlParams.get("serviciu") ?? "");
  const [query, setQuery] = useState(saved.query ?? (urlParams.get("q") || SERVICES[urlParams.get("serviciu")] || ""));
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
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
      : saved.locality || null,
  );
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  useEffect(() => {
    writeSearchSession({ sourceSearch: window.location.search, query, service, locality, searchMode, selectedId, mobileView });
  }, [query, service, locality, searchMode, selectedId, mobileView]);

  useEffect(() => {
    const rememberScroll = () => {
      if (restoredScroll.current) writeSearchSession({ scrollY: window.scrollY });
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => window.removeEventListener("scroll", rememberScroll);
  }, []);
  useEffect(() => {
    if (!locality || restoredScroll.current || results === null || (searchMode === RESULT_MODES.professionals.key && professionals === null)) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: saved.scrollY || 0, behavior: "instant" });
      restoredScroll.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [results, professionals, searchMode, saved.scrollY, locality]);

  // Verificare deterministica de siguranta, identica cu cea din fluxul ghidat /cerere.
  // Cautarea libera de aici nu trece prin QuestionText.jsx, deci fara acest control
  // un pacient care descrie un simptom grav direct in caseta de cautare nu ar primi
  // niciun avertisment.
  const safetyFlags = useMemo(
    () => deterministicSafetyFlagsFromText(debouncedQuery),
    [debouncedQuery],
  );
  const [dismissedFor, setDismissedFor] = useState("");
  const showSafetyBanner = safetyFlags.length > 0 && dismissedFor !== debouncedQuery;

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
    setProfessionals(null);
    setMatchContext(null);
    setLoadError(false);
    setProfessionalError(false);
  }, [service, query, locality?.siruta_code]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoadError(false);
      setResults(null);
      setMatchContext(null);
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
              provider_types: [],
              limit: 50,
            },
          );
          if (response.data?.error) throw new Error(response.data.error);
          if (active) setResults(response.data?.results || []);
          return;
        }

        const response = await matchProvidersWithSemanticFallback({
          search_text: service ? "" : debouncedQuery,
          service_keys: service ? [service] : [],
          provider_types: [],
          locality_siruta_code: locality.siruta_code,
          limit: 50,
        });
        if (response.data?.error) throw new Error(response.data.error);
        if (active) { setResults(response.data?.results || []); setMatchContext({ ...response.data, selected_locality_siruta_code: locality.siruta_code, query_scope: "locality" }); }
      } catch {
        if (active) { setLoadError(true); setResults([]); }
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [
    service,
    debouncedQuery,
    locality,
    isDirectoryBrowse,
    hasCanonicalLocality,
    retry,
  ]);

  useEffect(() => {
    if (searchMode !== RESULT_MODES.professionals.key) return undefined;
    if (!hasCanonicalLocality) {
      setProfessionals([]);
      return undefined;
    }
    let active = true;
    setProfessionals(null);
    setProfessionalError(false);
    if (!isDirectoryBrowse && !matchContext) return () => { active = false; };
    const request = isDirectoryBrowse
      ? browsePublicProfessionals({ localitySirutaCode: locality.siruta_code })
      : matchProfessionalsForRequest(matchContext);
    request
      .then((data) => { if (active) setProfessionals(data.results); })
      .catch(() => { if (active) { setProfessionalError(true); setProfessionals([]); } });
    return () => { active = false; };
  }, [searchMode, hasCanonicalLocality, locality, isDirectoryBrowse, matchContext, retry]);

  const chooseSuggestion = (suggestion) => {
    setService(suggestion.service_key);
    setQuery(suggestion.label);
    setSuggestionsOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
      <div className="sr-only">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Caută furnizori
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Explorează locațiile pe hartă sau alege localitatea și serviciul de care ai nevoie.
        </p>
      </div>

      <section
        className="relative z-40 mx-auto max-w-3xl rounded-3xl border border-border bg-card p-2 shadow-sm md:rounded-full md:px-5 md:py-2"
        aria-label="Căutare"
      >
        <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-4">
          <div className="min-w-0">
            <label htmlFor="directory-search" className="block px-4 pt-1 text-xs font-semibold">
              Ce cauți?
            </label>
            <div
              className="relative"
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setSuggestionsOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSuggestionsOpen(false);
              }}
            >
              <SearchIcon
                className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="directory-search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setService("");
                  setSuggestionsOpen(true);
                }}
                placeholder="Ex.: control de vedere, ochelari"
                autoComplete="off"
                className={`${SEARCH_INPUT} pl-11 pr-12`}
              />
              {(query || service) && (
                <button
                  type="button"
                  aria-label="Șterge căutarea"
                  onClick={() => { setQuery(""); setService(""); setSuggestionsOpen(false); }}
                  className="absolute right-1 top-0.5 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {suggestionsOpen && !service && query.trim() && suggestions.length > 0 && (
                <div
                  className="absolute z-30 mt-2 max-h-[min(22rem,55vh)] w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
                  aria-label="Sugestii de servicii"
                >
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.service_key}
                      type="button"
                      onClick={() => chooseSuggestion(suggestion)}
                      className="block min-h-12 w-full border-b border-border/60 px-4 py-3 text-left text-sm font-medium last:border-b-0 hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none active:bg-secondary"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="min-w-0 border-t border-border pt-1 md:border-l md:border-t-0 md:pl-3 md:pt-0" role="group" aria-labelledby="directory-locality-label">
            <span id="directory-locality-label" className="block px-4 pt-1 text-xs font-semibold">
              Unde?
            </span>
            <LocalityAutocomplete
              value={locality}
              onSelect={setLocality}
              placeholder="Alege localitatea"
              variant="compact"
              className="w-full"
            />
          </div>
        </div>
      </section>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>{locality ? `Rezultate în ${locality.name}` : "Explorează România sau alege localitatea."}</p>
        <Link to="/cerere" className="inline-flex min-h-11 items-center underline underline-offset-4">Ajută-mă să aleg</Link>
      </div>

      {hasCanonicalLocality && !showSafetyBanner && (
        <div className="mt-6">
          <ResultModeTabs
            mode={searchMode}
            onChange={setSearchMode}
            counts={{
              locations: Array.isArray(results) ? results.length : undefined,
              professionals: Array.isArray(professionals) ? professionals.length : undefined,
            }}
          />
        </div>
      )}

      {showSafetyBanner ? (
        <div className="mt-6">
          <UrgencyInterruption
            assessment={{ blocking: true, blocking_flags: safetyFlags }}
            onCorrect={() => setDismissedFor(debouncedQuery)}
            correctLabel="Nu e o urgență, continuă căutarea"
          />
        </div>
      ) : !hasCanonicalLocality ? (
        !service && !query.trim()
          ? <DirectoryMap />
          : <SelectLocalityNotice />
      ) : (loadError || (searchMode === RESULT_MODES.professionals.key && professionalError)) ? (
        <div role="alert" className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="font-semibold">Nu am putut încărca rezultatele.</p>
          <p className="mt-1 text-sm text-muted-foreground">Criteriile tale sunt păstrate. Încearcă din nou.</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 min-h-11 rounded-full border border-border px-5 text-sm font-semibold">Reîncearcă</button>
        </div>
      ) : searchMode === RESULT_MODES.professionals.key ? (
        <div className="mt-8">
          <h2 className="font-heading text-lg font-bold sm:text-xl">
            Specialiști în {locality?.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apar doar specialiștii cu profil verificat care au acceptat să fie afișați public la o
            locație din această localitate.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {professionals === null && <LoadingState />}
            {professionals?.length === 0 && <EmptyProfessionals locality={locality} />}
            {professionals?.map((professional) => (
              <ProfessionalDirectoryCard key={professional.id} professional={professional} />
            ))}
          </div>
        </div>
      ) : isDirectoryBrowseView ? (
        <div className="mt-8">
          <h2 className="font-heading text-lg font-bold sm:text-xl">
            Locații în {locality?.name}
          </h2>
          {results === null && <div className="mt-4"><LoadingState /></div>}
          {results?.length === 0 && <div className="mt-4"><EmptyDirectory /></div>}
          {results?.length > 0 && (
            <LocationsWithMap
              results={results}
              storageKey={`local:${locality.siruta_code}:${service}:${debouncedQuery}`}
              renderCard={(location) => <DirectoryResultCard location={location} />}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              mobileView={mobileView}
              onToggleMobileView={() => setMobileView((view) => (view === "map" ? "list" : "map"))}
            />
          )}
        </div>
      ) : (
        <div className="mt-8">
          {results === null && <LoadingState />}
          {results?.length === 0 && <EmptyMatch locality={locality} />}
          {results?.length > 0 && (
            <LocationsWithMap
              results={results}
              storageKey={`local:${locality.siruta_code}:${service}:${debouncedQuery}`}
              renderCard={(location) => <ProviderCard location={location} />}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              mobileView={mobileView}
              onToggleMobileView={() => setMobileView((view) => (view === "map" ? "list" : "map"))}
            />
          )}
        </div>
      )}
      <p className="pt-8 text-xs text-muted-foreground">
        VIASEE nu oferă diagnostic medical.
      </p>
    </div>
  );
}

function EmptyProfessionals({ locality }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center sm:col-span-2">
      <p className="text-sm font-semibold">
        Nu există încă specialiști publici în {locality?.name || "această localitate"}.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Un specialist apare aici după ce își verifică profilul și acceptă explicit să fie afișat la o
        locație. Până atunci, clinicile și opticile rămân calea cea mai directă.
      </p>
      <Link
        to="/pentru-specialisti"
        className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-semibold hover:bg-secondary"
      >
        Ești specialist? Creează-ți profilul
      </Link>
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
        Încearcă o căutare ghidată
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
        Încearcă o căutare ghidată
      </Link>
    </div>
  );
}