import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICES, PROVIDER_TYPES, PROFESSIONAL_TYPES } from "@/lib/vezunde";
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
  const [providerType, setProviderType] = useState(saved.providerType || "");
  const [professionalType, setProfessionalType] = useState(saved.professionalType || "");
  const [pagination, setPagination] = useState(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const pageRequest = useRef(0);
  const [matchContext, setMatchContext] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [professionalError, setProfessionalError] = useState(false);
  const [retry, setRetry] = useState(0);
  const restoredScroll = useRef(false);
  const controlsRef = useRef(null);
  const [stickySize, setStickySize] = useState({ nav: 80, controls: 160 });
  useEffect(() => {
    const headers = [...document.querySelectorAll("header")];
    const measure = () => {
      const header = headers.find((element) => element.getBoundingClientRect().height > 0);
      const nav = Math.ceil(header?.getBoundingClientRect().height || 0);
      const controls = Math.ceil(controlsRef.current?.getBoundingClientRect().height || 0);
      setStickySize((previous) => previous.nav === nav && previous.controls === controls ? previous : { nav, controls });
    };
    measure();
    const observer = new ResizeObserver(measure);
    headers.forEach((header) => observer.observe(header));
    if (controlsRef.current) observer.observe(controlsRef.current);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
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
    Object.prototype.hasOwnProperty.call(saved, "locality") ? saved.locality : initialLocalityName && initialSirutaCode
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
    writeSearchSession({ sourceSearch: window.location.search || saved.sourceSearch || "", query, service, locality, searchMode, selectedId, mobileView, providerType, professionalType });
  }, [query, service, locality, searchMode, selectedId, mobileView, saved.sourceSearch, providerType, professionalType]);

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
    pageRequest.current += 1;
    setPagination(null); setMoreLoading(false); setMoreError(false);
    setResults(null);
    setProfessionals(null);
    setMatchContext(null);
    setLoadError(false);
    setProfessionalError(false);
  }, [service, query, locality?.siruta_code, providerType]);

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

      if (debouncedQuery !== query.trim()) return;
      try {
        if (isDirectoryBrowse) {
          const response = await base44.functions.invoke(
            "browseDirectoryProviders",
            {
              locality_siruta_code: locality.siruta_code,
              provider_types: providerType ? [providerType] : [],
              limit: 50,
            },
          );
          if (response.data?.error) throw new Error(response.data.error);
          if (active) { setResults(response.data?.results || []); setPagination(response.data?.pagination || null); }
          return;
        }

        const response = await matchProvidersWithSemanticFallback({
          search_text: service ? "" : debouncedQuery,
          service_keys: service ? [service] : [],
          provider_types: providerType ? [providerType] : [],
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
    query,
    locality,
    isDirectoryBrowse,
    hasCanonicalLocality,
    retry,
    providerType,
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
    if (debouncedQuery !== query.trim()) return () => { active = false; };
    if (!isDirectoryBrowse && !matchContext) return () => { active = false; };
    const keys = matchContext?.resolved_service_keys || matchContext?.service_keys || [];
    if (!isDirectoryBrowse && keys.length === 0) { setProfessionals([]); return () => { active = false; }; }
    const request = isDirectoryBrowse
      ? browsePublicProfessionals({ localitySirutaCode: locality.siruta_code, professionalType })
      : matchProfessionalsForRequest({ ...matchContext, professional_type: professionalType });
    request
      .then((data) => { if (active) setProfessionals(data.results); })
      .catch(() => { if (active) { setProfessionalError(true); setProfessionals([]); } });
    return () => { active = false; };
  }, [searchMode, hasCanonicalLocality, locality, isDirectoryBrowse, matchContext, retry, debouncedQuery, query, professionalType]);

  const loadMore = async () => {
    if (!pagination?.has_more || moreLoading) return;
    const token = ++pageRequest.current;
    setMoreLoading(true); setMoreError(false);
    try {
      const response = await base44.functions.invoke("browseDirectoryProviders", {
        locality_siruta_code: locality.siruta_code, provider_types: providerType ? [providerType] : [],
        limit: 50, offset: pagination.next_offset,
      });
      if (response.data?.error) throw new Error(response.data.error);
      if (token !== pageRequest.current) return;
      setResults((previous) => {
        const rows = new Map((previous || []).map((row) => [row.id, row]));
        (response.data?.results || []).forEach((row) => rows.set(row.id, row));
        return [...rows.values()];
      });
      setPagination(response.data?.pagination || null);
    } catch { if (token === pageRequest.current) setMoreError(true); }
    finally { if (token === pageRequest.current) setMoreLoading(false); }
  };
  useEffect(() => () => { pageRequest.current += 1; }, []);

  const resetSearch = () => {
    setProviderType(""); setProfessionalType("");
    setQuery(""); setService(""); setLocality(null);
    setSelectedId(null); setHoveredId(null);
    setSearchMode(RESULT_MODES.locations.key);
    setSuggestionsOpen(false);
    writeSearchSession({ maps: {}, national: {}, scrollY: 0, nationalScroll: 0 });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const chooseSuggestion = (suggestion) => {
    setService(suggestion.service_key);
    setQuery(suggestion.label);
    setSuggestionsOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 pb-10 sm:px-6 lg:px-8" style={{ "--search-nav-height": `${stickySize.nav}px`, "--search-controls-height": `${stickySize.controls}px` }}>
      <div className="sr-only">
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Caută furnizori
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          Explorează locațiile pe hartă sau alege localitatea și serviciul de care ai nevoie.
        </p>
      </div>

      <div ref={controlsRef} data-search-controls className="sticky z-30 -mx-4 border-b border-border bg-background px-4 pb-3 pt-5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ top: "var(--search-nav-height)" }}>
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
        <div className="flex flex-wrap items-center gap-4">
          {(query.trim() || service || locality || providerType || professionalType) && <button type="button" onClick={resetSearch} className="inline-flex min-h-11 items-center gap-1.5 text-sm hover:text-foreground focus-visible:outline focus-visible:outline-2"><X className="h-3.5 w-3.5" /> Resetează căutarea</button>}
          <Link to="/cerere" className="inline-flex min-h-11 items-center underline underline-offset-4">Ajută-mă să aleg</Link>
        </div>
      </div>

      {!showSafetyBanner && (
        <div className="mt-2 flex items-center gap-3">
          <label htmlFor="search-type" className="text-xs font-semibold text-muted-foreground">Tip</label>
          <select id="search-type" value={searchMode === RESULT_MODES.professionals.key && hasCanonicalLocality ? professionalType : providerType}
            onChange={(event) => searchMode === RESULT_MODES.professionals.key && hasCanonicalLocality ? setProfessionalType(event.target.value) : setProviderType(event.target.value)}
            className="min-h-11 max-w-full rounded-full border border-border bg-card px-4 text-sm">
            <option value="">Toate tipurile</option>
            {Object.entries(searchMode === RESULT_MODES.professionals.key && hasCanonicalLocality ? PROFESSIONAL_TYPES : Object.fromEntries(Object.entries(PROVIDER_TYPES).filter(([key]) => ["optica_medicala", "cabinet_optometric", "cabinet_oftalmologic", "clinica_oftalmologica", "laborator_optic"].includes(key)))).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      )}
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

      </div>

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
          ? <DirectoryMap providerType={providerType} />
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
            {professionals?.length === 0 && (!isDirectoryBrowse && !(matchContext?.resolved_service_keys || matchContext?.service_keys || []).length
              ? <p className="rounded-2xl border border-border bg-card p-6 text-sm sm:col-span-2">Alege un serviciu din sugestii pentru a vedea specialiști potriviți sau folosește „Ajută-mă să aleg”.</p>
              : <EmptyProfessionals locality={locality} />)}
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
          {pagination && <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">{results?.length || 0} din {pagination.total} locații</p>}
          {results === null && <div className="mt-4"><LoadingState /></div>}
          {results?.length === 0 && <div className="mt-4"><EmptyDirectory /></div>}
          {results?.length > 0 && (
            <LocationsWithMap
              results={results}
              storageKey={`local:${locality.siruta_code}:${service}:${debouncedQuery}:${providerType}`}
              renderCard={(location, onShowMap) => <DirectoryResultCard location={location} onShowMap={onShowMap} />}
              integratedMapAction
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              mobileView={mobileView}
              onToggleMobileView={() => setMobileView((view) => (view === "map" ? "list" : "map"))}
            />
          )}
          {pagination?.has_more && <div className="mt-5">{moreError && <p role="alert" className="mb-2 text-sm">Nu am putut încărca următoarele locații.</p>}<button type="button" onClick={loadMore} disabled={moreLoading} className="min-h-11 rounded-full border border-border bg-card px-6 text-sm font-semibold disabled:opacity-50">{moreLoading ? "Se încarcă..." : moreError ? "Reîncearcă" : "Arată mai multe"}</button></div>}
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