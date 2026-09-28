import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MapPin, Search as SearchIcon, X } from "lucide-react";
import { invokeDirectoryBrowse } from "@/lib/directoryBrowse";
import { SERVICES, DIRECTORY_PROVIDER_FILTER_LABELS, PROFESSIONAL_TYPES } from "@/lib/vezunde";
import { CANONICAL_SERVICE_REGISTRY } from "@/lib/canonicalServiceCatalog";
import { resolveServiceSearchQuery } from "@/lib/serviceSemanticSearch";
import { matchProvidersWithSemanticFallback } from "@/lib/providerSemanticSearch";
import { deterministicSafetyFlagsFromText } from "@/lib/patientSafety";
import UrgencyInterruption from "@/components/intake2/UrgencyInterruption";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";
import ServiceMatchDetails from "@/components/results/ServiceMatchDetails";
import ProfessionalDirectoryCard from "@/components/results/ProfessionalDirectoryCard";
import ResultModeTabs, { RESULT_MODES } from "@/components/intake2/ResultModeTabs";
import LocationsWithMap from "@/components/results/LocationsWithMap";
import { preloadVectorCanvas } from "@/components/results/vectorCanvasLoader";
import SearchFilters from "@/components/results/SearchFilters";
import DirectoryMap from "@/pages/DirectoryMap";
import { browsePublicProfessionals, matchProfessionalsForRequest } from "@/lib/professionalSearch";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";
import ServiceSearchField from "@/components/results/ServiceSearchField";
import { MAJOR_CITIES, readRecentLocalities, rememberLocality, prettyLocality } from "@/lib/localityQuickPicks";

import { readSearchSession, writeSearchSession } from "@/lib/searchSession";
import { criteriaQuery, searchCriteriaFor, searchStateFromUrl, searchUrlFor } from "@/lib/searchUrl";

const serviceLabel = (key) => SERVICES[key] || CANONICAL_SERVICE_REGISTRY[key]?.label || "";
// Dintr-un link se pastreaza doar valorile cunoscute; restul (scrise gresit sau vechi) se ignora,
// ca pe ecran sa nu apara chei tehnice drept filtre.
function knownLinkedState(state) {
  return {
    ...state,
    service: serviceLabel(state.service) ? state.service : "",
    providerType: state.providerType.split(",").filter((key) => DIRECTORY_PROVIDER_FILTER_LABELS[key]).join(","),
    filterServiceKeys: state.filterServiceKeys.filter((key) => CANONICAL_SERVICE_REGISTRY[key]),
    professionalType: PROFESSIONAL_TYPES[state.professionalType] ? state.professionalType : "",
  };
}

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
  // Harta vectoriala se descarca in paralel cu datele, fara sa blocheze pagina si lista.
  useEffect(() => { preloadVectorCanvas(); }, []);
  const routerLocation = useLocation();
  const navigate = useNavigate();
  // 2026-09-28 (audit /cauta, B4): criteriile vin din adresa cand exista. Un link primit castiga in
  // fata ultimei cautari din sesiune; aceeasi adresa ca la plecare (inapoi de pe un profil) reia
  // sesiunea intreaga (pagini incarcate, selectie, derulare). Fara criterii in adresa, /cauta reia
  // ultima cautare. Un link fara localitate pastreaza localitatea din ultima cautare.
  const [{ saved, fromUrl }] = useState(() => {
    const previous = readSearchSession();
    const incoming = criteriaQuery(window.location.search);
    if (!incoming || previous.sourceSearch === incoming) return { saved: previous, fromUrl: searchStateFromUrl("") };
    const linked = knownLinkedState(searchStateFromUrl(window.location.search, serviceLabel));
    return { saved: {}, fromUrl: { ...linked, locality: linked.locality || previous.locality || null } };
  });
  const [results, setResults] = useState(null);
  const [mapResults, setMapResults] = useState(null);
  const [providerType, setProviderType] = useState(saved.providerType ?? fromUrl.providerType);
  const [professionalType, setProfessionalType] = useState(saved.professionalType ?? fromUrl.professionalType);
  const [filterServiceKeys, setFilterServiceKeys] = useState(saved.filterServiceKeys ?? fromUrl.filterServiceKeys);
  const [casOnly, setCasOnly] = useState(saved.casOnly ?? fromUrl.casOnly);
  const [pagination, setPagination] = useState(null);
  const [directoryFilterContext, setDirectoryFilterContext] = useState(null);
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
  // A2: pe telefon si tableta controalele nu mai sunt fixate; cand ies de sub antet, apare bara
  // compacta. Pe desktop controalele sunt `lg:sticky`, deci raman vizibile si bara nu apare (lg:hidden).
  const [controlsOut, setControlsOut] = useState(false);
  useEffect(() => {
    const element = controlsRef.current;
    if (!element || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setControlsOut(!entry.isIntersecting && entry.boundingClientRect.top < stickySize.nav),
      { rootMargin: `-${stickySize.nav}px 0px 0px 0px` },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [stickySize.nav]);
  // 2026-09-03: /cauta rasfoia doar locatii. Pacientul care stie ca vrea "un oftalmolog din Sibiu"
  // nu avea de unde sa inceapa - trebuia sa deschida clinici una cate una si sa se uite la echipa.
  // Acelasi selector ca in rezultatele cererii, ca sa fie evident ca e aceeasi idee.
  const [searchMode, setSearchMode] = useState(saved.searchMode || fromUrl.searchMode);
  // 2026-09-06: aceeasi harta ca pe ecranul de recomandari, ca rasfoirea unei localitati sa arate
  // si UNDE sunt locatiile, nu doar care sunt. Selectia si evidentierea merg in ambele sensuri.
  const [selectedId, setSelectedId] = useState(saved.selectedId || null);
  const [hoveredId, setHoveredId] = useState(null);
  const [mobileView, setMobileView] = useState(saved.mobileView || "list");
  const [professionals, setProfessionals] = useState(null);
  const [service, setService] = useState(saved.service ?? fromUrl.service);
  const [query, setQuery] = useState(saved.query ?? fromUrl.query);
  const localityFieldRef = useRef(null);
  const [locality, setLocality] = useState(
    Object.prototype.hasOwnProperty.call(saved, "locality") ? saved.locality : fromUrl.locality,
  );
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  // B4: adresa urmeaza criteriile asezate (fara intrari noi in istoric, fara derulare). Textul scris
  // liber nu intra in adresa (poate descrie simptome); ramane in pagina si in sesiune.
  const criteriaSearch = searchCriteriaFor({ service, locality, providerType, filterServiceKeys, casOnly, searchMode, professionalType });
  const settling = debouncedQuery !== query.trim();
  const writtenCriteria = useRef(criteriaQuery(window.location.search));
  const replaceCriteria = (criteria) => {
    writtenCriteria.current = criteria;
    navigate({ pathname: routerLocation.pathname, search: searchUrlFor(routerLocation.search, criteria), hash: routerLocation.hash }, { replace: true, state: routerLocation.state });
  };
  // Un link deschis cat timp /cauta e deja pe ecran (ex. „Caută un oftalmolog” din avertisment)
  // inlocuieste criteriile; un link simplu catre /cauta (meniul) pastreaza cautarea curenta.
  useEffect(() => {
    const incoming = criteriaQuery(routerLocation.search);
    if (incoming === writtenCriteria.current) return;
    if (!incoming) { if (criteriaSearch) replaceCriteria(criteriaSearch); else writtenCriteria.current = ""; return; }
    const next = knownLinkedState(searchStateFromUrl(routerLocation.search, serviceLabel));
    writtenCriteria.current = incoming;
    setService(next.service); setQuery(next.query); setLocality(next.locality || locality);
    setProviderType(next.providerType); setFilterServiceKeys(next.filterServiceKeys); setCasOnly(next.casOnly);
    setSearchMode(next.searchMode); setProfessionalType(next.professionalType);
    setSelectedId(null); setHoveredId(null);
  }, [routerLocation.search]);
  useEffect(() => {
    if (settling) return;
    if (criteriaQuery(routerLocation.search) === criteriaSearch) { writtenCriteria.current = criteriaSearch; return; }
    replaceCriteria(criteriaSearch);
  }, [criteriaSearch, settling]);

  useEffect(() => {
    writeSearchSession({ sourceSearch: criteriaSearch, query, service, locality, searchMode, selectedId, mobileView, providerType, professionalType, filterServiceKeys, casOnly, loadedLocalCount: results?.length || 0 });
  }, [criteriaSearch, query, service, locality, searchMode, selectedId, mobileView, providerType, professionalType, filterServiceKeys, casOnly, results]);

  // 2026-09-28 (audit /cauta, B5): pozitia paginii se salveaza dupa ce derularea se opreste (si la
  // plecare), nu la fiecare eveniment. Fiecare salvare citeste si rescrie toata sesiunea de cautare
  // (pana la ~35 KB), iar pe telefon asta facea derularea sacadata. Ca in DirectoryMap.
  useEffect(() => {
    let timer = 0;
    let lastY = window.scrollY;
    let pending = false;
    const save = () => {
      clearTimeout(timer);
      timer = 0;
      if (!pending) return;
      pending = false;
      if (restoredScroll.current) writeSearchSession({ scrollY: lastY });
    };
    const rememberScroll = () => {
      lastY = window.scrollY;
      pending = true;
      clearTimeout(timer);
      timer = setTimeout(save, 200);
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("scroll", rememberScroll);
      window.removeEventListener("pagehide", save);
      save();
    };
  }, []);
  useEffect(() => {
    // B1: in fila Specialisti lista de locatii poate sa nu fie ceruta deloc, deci se asteapta doar specialistii.
    const waiting = searchMode === RESULT_MODES.professionals.key ? professionals === null : results === null;
    if (!locality || restoredScroll.current || waiting) return;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: window.matchMedia("(min-width: 1024px)").matches && searchMode === RESULT_MODES.locations.key ? 0 : saved.scrollY || 0, behavior: "instant" });
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

  const hasCanonicalLocality = Boolean(locality?.siruta_code);
  const isDirectoryBrowse = !service && !debouncedQuery && hasCanonicalLocality;
  // 2026-09-27 (audit /cauta, A4): vederea urmeaza textul deja asezat (debouncedQuery), la fel ca
  // rezultatele. Inainte urma textul brut: la prima litera tastata pagina trecea pe alt aspect
  // ("Opțiuni", pini numerotati) peste rezultatele vechi, apoi golea lista si harta.
  const isDirectoryBrowseView = isDirectoryBrowse;
  // Textul din campul de serviciu inca se tasteaza (nu a trecut pauza de 350 ms). Cat timp e asa,
  // nimic nu se reseteaza si nu se cere nimic: ramane pe ecran ultima cautare. Si alegerea unui
  // serviciu se sterge la prima litera (onQueryChange), deci si ea asteapta pauza.
  const typing = hasCanonicalLocality && debouncedQuery !== query.trim();

  const previousCriteria = useRef(null);
  // B1: cheia cererii ale carei rezultate sunt deja pe ecran. Aceeasi cheie = nimic de cerut din nou.
  const loadedKey = useRef(null);
  useEffect(() => {
    if (typing) return;
    const criteria = JSON.stringify([service, debouncedQuery, locality?.siruta_code, providerType, filterServiceKeys, casOnly]);
    // Aceleasi criterii (ex. „Arată rezultatele” fara nicio schimbare): nimic de resetat.
    if (previousCriteria.current === criteria) return;
    if (previousCriteria.current !== null) { setSelectedId(null); setHoveredId(null); }
    previousCriteria.current = criteria;
    loadedKey.current = null;
    pageRequest.current += 1;
    setPagination(null); setDirectoryFilterContext(null); setMoreLoading(false); setMoreError(false);
    setMapResults(null);
    setResults(null);
    setProfessionals(null);
    setMatchContext(null);
    setLoadError(false);
    setProfessionalError(false);
  }, [typing, service, debouncedQuery, locality?.siruta_code, providerType, filterServiceKeys, casOnly]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      // A4: cat timp vizitatorul tasteaza, ramane pe ecran ce era; cererea porneste dupa pauza.
      if (hasCanonicalLocality && debouncedQuery !== query.trim()) return;
      const locationMode = searchMode === RESULT_MODES.locations.key;
      // 2026-09-28 (audit /cauta, B1): schimbarea filei nu mai reincarca locatiile. La rasfoire,
      // fila Specialisti are propria cerere, deci lista de locatii (cu paginile deja incarcate)
      // ramane neatinsa. La cautarea dupa serviciu, cererea se repeta doar daca difera efectiv
      // (filtrele de locatii nu se aplica specialistilor); aceleasi date intra in potrivire.
      if (hasCanonicalLocality && isDirectoryBrowse && !locationMode) { setLoadError(false); return; }
      const requestKey = hasCanonicalLocality ? JSON.stringify(isDirectoryBrowse
        ? ["browse", locality.siruta_code, providerType, filterServiceKeys, casOnly]
        : ["match", service, debouncedQuery, locality.siruta_code, locationMode ? providerType : "", locationMode ? filterServiceKeys : [], locationMode && casOnly]) : null;
      if (requestKey && requestKey === loadedKey.current) return;
      loadedKey.current = null;
      setLoadError(false);
      setResults(null);
      setMatchContext(null);
      if (!hasCanonicalLocality) {
        if (active) setResults([]);
        return;
      }

      try {
        if (isDirectoryBrowse) {
          const response = await invokeDirectoryBrowse(
            {
              locality_siruta_code: locality.siruta_code,
              provider_types: locationMode ? providerType.split(",").filter(Boolean) : [], filter_service_keys: locationMode ? filterServiceKeys : [], cas_only: locationMode && casOnly,
              limit: 50,
              include_map_results: true,
            },
          );
          if (response.data?.error) throw new Error(response.data.error);
          const rows = new Map((response.data?.results || []).map((row) => [row.id, row]));
          let page = response.data?.pagination || null;
          const restoreCount = saved.locality?.siruta_code === locality.siruta_code && (saved.providerType || "") === providerType && JSON.stringify(saved.filterServiceKeys || []) === JSON.stringify(filterServiceKeys) && Boolean(saved.casOnly) === casOnly && !saved.query && !saved.service ? saved.loadedLocalCount || 0 : 0;
          while (active && locationMode && page?.has_more && rows.size < restoreCount) {
            const next = await invokeDirectoryBrowse({ locality_siruta_code: locality.siruta_code, provider_types: providerType.split(",").filter(Boolean), filter_service_keys: filterServiceKeys, cas_only: casOnly, limit: 50, offset: page.next_offset });
            if (next.data?.error) throw new Error(next.data.error);
            const previousSize = rows.size;
            (next.data?.results || []).forEach((row) => rows.set(row.id, row));
            page = next.data?.pagination || null;
            if (rows.size === previousSize) break;
          }
          if (active) { loadedKey.current = requestKey; setResults([...rows.values()]); setMapResults(response.data?.map_results || [...rows.values()]); setPagination(page); setDirectoryFilterContext(response.data?.filter_context || null); }
          return;
        }

        // Reuse the public directory's eligibility rules; narrow candidates BEFORE matching,
        // never post-filter a truncated Top 50 or turn a CAS label into an inferred promise.
        let directoryFilterIds;
        if (searchMode === RESULT_MODES.locations.key && (filterServiceKeys.length || casOnly)) {
          const filtered = await invokeDirectoryBrowse({
            locality_siruta_code: locality.siruta_code,
            provider_types: providerType.split(",").filter(Boolean),
            filter_service_keys: filterServiceKeys.length ? filterServiceKeys : casOnly ? (service ? [service] : resolveServiceSearchQuery(debouncedQuery).service_keys) : [], cas_only: casOnly,
            include_map_results: true, limit: 1,
          });
          if (filtered.data?.error || !Array.isArray(filtered.data?.map_results)) throw new Error("Filtrele nu au putut fi verificate.");
          directoryFilterIds = filtered.data.map_results.map(row => row.id);
        }
        if (!active) return;
        const response = await matchProvidersWithSemanticFallback({
          search_text: service ? "" : debouncedQuery,
          directory_filter_location_ids: directoryFilterIds,
          service_keys: service ? [service] : [],
          provider_types: locationMode ? providerType.split(",").filter(Boolean) : [],
          locality_siruta_code: locality.siruta_code,
          limit: 50,
        });
        if (response.data?.error) throw new Error(response.data.error);
        if (active) { loadedKey.current = requestKey; setResults(response.data?.results || []); setMapResults(response.data?.results || []); setMatchContext({ ...response.data, selected_locality_siruta_code: locality.siruta_code, query_scope: "locality" }); }
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
    retry, searchMode,
    providerType, filterServiceKeys, casOnly,
  ]);

  useEffect(() => {
    if (searchMode !== RESULT_MODES.professionals.key) return undefined;
    if (!hasCanonicalLocality) {
      setProfessionals([]);
      return undefined;
    }
    // A4: specialistii raman pe ecran cat timp textul inca se tasteaza.
    if (debouncedQuery !== query.trim()) return undefined;
    let active = true;
    setProfessionals(null);
    setProfessionalError(false);
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
      const response = await invokeDirectoryBrowse({
        locality_siruta_code: locality.siruta_code, provider_types: providerType.split(",").filter(Boolean), filter_service_keys: filterServiceKeys, cas_only: casOnly,
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
    setProviderType(""); setProfessionalType(""); setFilterServiceKeys([]); setCasOnly(false);
    setQuery(""); setService(""); setLocality(null);
    setSelectedId(null); setHoveredId(null);
    setSearchMode(RESULT_MODES.locations.key);
    writeSearchSession({ maps: {}, listScroll: {}, national: {}, scrollY: 0, nationalScroll: 0 });
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  // Dupa serviciu, pasul urmator e localitatea: daca lipseste, cursorul trece direct acolo.
  const chooseSuggestion = (suggestion) => {
    setService(suggestion.service_key);
    setQuery(suggestion.label);
    if (!hasCanonicalLocality) window.requestAnimationFrame(() => localityFieldRef.current?.focus());
  };
  const chooseLocality = (value) => { setLocality(value); setSelectedId(null); };

  // Cheia listei si a hartii se schimba doar dupa pauza de tastare, altfel lista si harta s-ar
  // remonta la prima litera (cand se sterge serviciul ales).
  const liveMapKey = JSON.stringify(["local", locality?.siruta_code, service, debouncedQuery, providerType, [...filterServiceKeys].sort(), casOnly]);
  const [settledMapKey, setSettledMapKey] = useState(liveMapKey);
  useEffect(() => { if (!typing) setSettledMapKey(liveMapKey); }, [typing, liveMapKey]);
  const searchMapKey = settledMapKey;
  const extraSelection = isDirectoryBrowseView && selectedId && !results?.some(row => row.id === selectedId)
    ? mapResults?.find(row => row.id === selectedId) : null;
  const locationList = extraSelection ? [extraSelection, ...(results || [])] : results;
  const activeFilters = searchMode === RESULT_MODES.professionals.key && hasCanonicalLocality
    ? (professionalType ? [{ key: "profession", label: PROFESSIONAL_TYPES[professionalType] || professionalType, remove: () => setProfessionalType("") }] : [])
    : [
      ...providerType.split(",").filter(Boolean).map(key => ({ key, label: DIRECTORY_PROVIDER_FILTER_LABELS[key] || key, remove: () => setProviderType(providerType.split(",").filter(value => value !== key).join(",")) })),
      // B3: fara localitate (harta Romaniei) serviciile si CAS nu se pot aplica; raman in asteptare.
      ...filterServiceKeys.map(key => ({ key, pending: !hasCanonicalLocality, label: CANONICAL_SERVICE_REGISTRY[key]?.label || key, remove: () => setFilterServiceKeys(filterServiceKeys.filter(value => value !== key)) })),
      ...(casOnly ? [{ key: "cas", pending: !hasCanonicalLocality, label: "Decontare CAS", remove: () => setCasOnly(false) }] : []),
    ];
  const appliedFilters = activeFilters.filter(filter => !filter.pending);
  const pendingFilters = activeFilters.filter(filter => filter.pending);
  const filterChip = (filter) => <button key={filter.key} type="button" onClick={filter.remove} aria-label={`Elimină filtrul ${filter.label}`} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-medium ${filter.pending ? "border-dashed border-[#a7b4c9] bg-card text-muted-foreground hover:bg-[#eff1f5]" : "border-[#d7dce4] bg-[#eff1f5] text-[#4f6080] hover:bg-[#e2e7f0]"}`}>{filter.label}<X className="h-3.5 w-3.5" aria-hidden="true" /></button>;
  const filterSummary = activeFilters.length > 0 && <div className="my-3 space-y-2">
    {appliedFilters.length > 0 && <div role="group" aria-label="Filtre active" className="flex flex-wrap gap-2">{appliedFilters.map(filterChip)}</div>}
    {pendingFilters.length > 0 && <div role="group" aria-labelledby="pending-filters-note" className="flex flex-wrap items-center gap-2">
      <span id="pending-filters-note" className="text-xs text-muted-foreground">Se aplică după ce alegi localitatea:</span>
      {pendingFilters.map(filterChip)}
    </div>}
  </div>;
  const localListHeader = <div className="mb-4">
    <h2 className="font-heading text-lg font-bold sm:text-xl">{isDirectoryBrowseView ? "Locații" : "Opțiuni"} în {locality?.name}</h2>
    <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
      {isDirectoryBrowseView ? `${results?.length || 0} din ${pagination?.total ?? results?.length ?? 0} locații · Ordine alfabetică` : `${results?.length || 0} opțiuni · ${matchContext?.coverage_status === "query_not_mapped" ? "Explorare, fără potrivire confirmată" : "Ordinea potrivirii"}`}
    </p>
    <p className="mt-1 text-xs text-muted-foreground">{isDirectoryBrowseView ? "Harta include toate locațiile filtrate cu poziție publicată, inclusiv cele neîncărcate încă în listă." : "Sunt afișate până la 50 de opțiuni. Harta păstrează aceleași rezultate; poziția pe hartă nu schimbă potrivirea."}</p>
    {extraSelection && <p className="mt-2 text-xs text-[#4f6080]">Locația selectată pe hartă este afișată prima.</p>}
    {filterSummary}
  </div>;

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

      {/* 2026-09-27 (audit /cauta, A2): controalele raman fixate sus doar pe desktop. Pe telefon ocupau
          ~360 px din 816 (44% din ecran) la derulare; acolo o bara compacta ia locul lor cand ies din
          ecran (CompactSearchBar, mai jos). */}
      <div ref={controlsRef} data-search-controls className="relative z-30 -mx-4 border-b border-border bg-background px-4 py-2 sm:-mx-6 sm:px-6 lg:sticky lg:top-[var(--search-nav-height)] lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
      <section
        className="relative z-40 w-full min-w-0 rounded-3xl border border-[#e1e3e8] bg-card px-2 py-1.5 shadow-[0_2px_10px_rgba(30,40,60,0.07)] transition-shadow focus-within:shadow-md sm:flex-1 md:w-auto md:rounded-full"
        aria-label="Căutare"
      >
        {/* Pe telefon cele doua campuri stau unul sub altul, ca textul sa se vada intreg. */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-2">
          <div className="min-w-0">
            <ServiceSearchField
              query={query}
              service={service}
              onQueryChange={(value) => { setQuery(value); setService(""); }}
              onChoose={chooseSuggestion}
              onClear={() => { setQuery(""); setService(""); }}
            />
          </div>
          <div className="relative min-w-0 border-t border-border pl-7 md:border-l md:border-t-0" role="group" aria-labelledby="directory-locality-label">
            <MapPin className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-[#4f6080] md:left-3" aria-hidden="true" /><span id="directory-locality-label" className="sr-only">
              Unde?
            </span>
            <LocalityAutocomplete
              ref={localityFieldRef}
              guided
              showCounts={!service && !query.trim()}
              value={locality}
              onSelect={chooseLocality}
              placeholder="În ce localitate?"
              variant="compact"
              className="w-full"
            />
          </div>
        </div>
      </section>


      <SearchFilters providerType={providerType} professionalType={professionalType} serviceKeys={filterServiceKeys} casOnly={casOnly}
        hasLocality={hasCanonicalLocality} professionalMode={searchMode === RESULT_MODES.professionals.key && hasCanonicalLocality}
        searchedLabel={query.trim()} browseLocality={isDirectoryBrowseView ? locality : null} browseTotal={isDirectoryBrowseView && results !== null ? pagination?.total ?? null : null}
        onApply={(filters) => {
          if (searchMode === RESULT_MODES.professionals.key && hasCanonicalLocality) { setProfessionalType(filters.professionalType); return; }
          setProviderType(filters.providerType);
          setFilterServiceKeys(filters.serviceKeys); setCasOnly(filters.casOnly); setSelectedId(null);
        }} />
      <Link to="/cerere" className="inline-flex min-h-11 items-center rounded-full px-3 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground">Ajută-mă să aleg</Link>
      </div>
      {hasCanonicalLocality && !showSafetyBanner && <div className="mx-auto mt-2 flex max-w-4xl flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
        <ResultModeTabs compact mode={searchMode} onChange={setSearchMode} />
        <button type="button" onClick={resetSearch} className="min-h-11 text-xs underline">Resetează căutarea</button>
      </div>}

      </div>

      {controlsOut && <CompactSearchBar query={query.trim()} locality={locality} />}

      {showSafetyBanner ? (
        <div className="mt-6">
          <UrgencyInterruption
            assessment={{ blocking: true, blocking_flags: safetyFlags }}
            onCorrect={() => setDismissedFor(debouncedQuery)}
            correctLabel="Nu e o urgență, continuă căutarea"
          />
        </div>
      ) : !hasCanonicalLocality ? (
        // A4: harta Romaniei nu dispare la prima litera tastata; mesajul „alege localitatea” vine
        // dupa ce textul se aseaza.
        !service && !debouncedQuery
          ? <DirectoryMap providerType={providerType} filterSummary={filterSummary} />
          : <SelectLocalityNotice onChoose={(value) => { rememberLocality(value); chooseLocality(value); }} onFocusField={() => localityFieldRef.current?.focus()} />
      ) : (loadError || (searchMode === RESULT_MODES.professionals.key && professionalError)) ? (
        <div role="alert" className="mt-6 rounded-2xl border border-border bg-card p-6">
          <p className="font-semibold">Nu am putut încărca rezultatele.</p>
          <p className="mt-1 text-sm text-muted-foreground">Criteriile tale sunt păstrate. Încearcă din nou.</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-4 min-h-11 rounded-full border border-border px-5 text-sm font-semibold">Reîncearcă</button>
        </div>
      ) : searchMode === RESULT_MODES.professionals.key ? (
        <div className="mt-4">
          <h2 className="font-heading text-lg font-bold sm:text-xl">
            Specialiști în {locality?.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Apar doar specialiștii cu profil verificat care au acceptat să fie afișați public la o
            locație din această localitate.
          </p>
          {filterSummary}
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
      ) : (
        <div className="mt-4">
          {results === null && <LoadingState />}
          {results !== null && (
            <LocationsWithMap
              key={searchMapKey}
              fixedDesktop
              listHeader={localListHeader}
              results={mapResults || results}
              listResults={locationList}
              storageKey={searchMapKey}
              integratedMapAction
              // 2026-09-28 (audit /cauta, E1): un singur card pe /cauta. La cautarea dupa serviciu,
              // cardul poarta numarul pinului si detaliile potrivirii; ordinea ramane cea primita.
              listLayout="grid"
              numbered={!isDirectoryBrowseView}
              renderCard={(location, onShowMap, rank) => isDirectoryBrowseView
                ? <DirectoryResultCard location={location} onShowMap={onShowMap} />
                : <DirectoryResultCard location={location} onShowMap={onShowMap} rank={rank} details={<ServiceMatchDetails location={location} />} />}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={setSelectedId}
              onHover={setHoveredId}
              mobileView={mobileView}
              onToggleMobileView={() => setMobileView(view => view === "map" ? "list" : "map")}
            >
              {results.length === 0 && (isDirectoryBrowseView ? <EmptyDirectory filterContext={directoryFilterContext} serviceFiltered={filterServiceKeys.length > 0 || casOnly} onClearServiceFilters={() => { setFilterServiceKeys([]); setCasOnly(false); }} /> : <EmptyMatch locality={locality} filtered={activeFilters.length > 0} />)}
              {isDirectoryBrowseView && pagination?.has_more && <div className="mt-5">{moreError && <p role="alert" className="mb-2 text-sm">Nu am putut încărca următoarele locații.</p>}<button type="button" onClick={loadMore} disabled={moreLoading} className="min-h-11 rounded-full border border-border bg-card px-6 text-sm font-semibold disabled:opacity-50">{moreLoading ? "Se încarcă..." : moreError ? "Reîncearcă" : "Arată mai multe"}</button></div>}
            </LocationsWithMap>
          )}
        </div>
      )}
      <p className="pt-8 text-xs text-muted-foreground lg:hidden">
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

// 2026-09-27 (audit /cauta, A2): pe telefon si tableta, cand controalele de cautare ies din ecran,
// ramane sub antet o singura bara (ca la Airbnb) care spune ce cauti si unde. Apasata, duce inapoi
// la controale. Pe desktop controalele raman fixate si bara nu se afiseaza.
function CompactSearchBar({ query, locality }) {
  const backToControls = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "instant" : "smooth" });
  };
  return (
    <div data-compact-search className="fixed inset-x-0 z-30 border-b border-border bg-background/95 px-4 py-2 backdrop-blur-sm lg:hidden" style={{ top: "var(--search-nav-height)" }}>
      <button
        type="button"
        onClick={backToControls}
        className="mx-auto flex min-h-11 w-full max-w-xl items-center gap-3 rounded-full border border-[#e1e3e8] bg-card py-1 pl-4 pr-1 text-left shadow-[0_2px_10px_rgba(30,40,60,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <SearchIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#4f6080]" />
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold text-foreground">{query || "Orice serviciu"}</span>
          <span className="text-muted-foreground"> · {locality?.name || "Toată România"}</span>
        </span>
        <span className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-secondary px-3 text-xs font-semibold text-foreground">Modifică</span>
      </button>
    </div>
  );
}

// Serviciul e ales, localitatea lipseste: pasul urmator spus clar, cu orasele mari si
// localitatile recente la un click distanta.
function SelectLocalityNotice({ onChoose, onFocusField }) {
  const [recent] = useState(() => readRecentLocalities().map(prettyLocality));
  const recentCodes = new Set(recent.map((item) => item.siruta_code));
  const picks = [...recent, ...MAJOR_CITIES.filter((city) => !recentCodes.has(city.siruta_code))].slice(0, 8);
  return (
    <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
      <p className="font-heading text-lg font-bold">În ce localitate cauți?</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Arătăm doar locațiile din localitatea aleasă, fără să extindem căutarea în alte orașe.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {picks.map((city) => (
          <button
            key={city.siruta_code}
            type="button"
            onClick={() => onChoose(city)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#d7dce4] bg-card px-4 text-sm font-medium transition hover:border-[#4f6080] hover:bg-[#eff1f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]"
          >
            <MapPin className="h-3.5 w-3.5 text-[#4f6080]" aria-hidden="true" />
            {city.name}
          </button>
        ))}
      </div>
      <button type="button" onClick={onFocusField} className="mt-4 min-h-11 text-sm font-medium text-[#4f6080] underline underline-offset-4">
        Altă localitate
      </button>
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

function EmptyDirectory({ filterContext, serviceFiltered, onClearServiceFilters }) {
  const unconfirmedServices = serviceFiltered && filterContext?.unfiltered_total > 0
    && filterContext.locations_with_published_services === 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center sm:col-span-2 sm:p-10">
      <p className="font-heading font-bold">
        {unconfirmedServices ? "Serviciile nu sunt încă confirmate în VIASEE pentru aceste locații." : serviceFiltered ? "Nu avem confirmarea serviciului sau a decontării CAS pentru filtrele alese." : "Nu există rezultate pentru localitatea și filtrele selectate."}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {unconfirmedServices ? `Există ${filterContext.unfiltered_total} locații pentru tipul și localitatea selectate, dar serviciile lor nu sunt publicate ca fiind confirmate.` : serviceFiltered ? "O locație poate oferi serviciul chiar dacă nu este încă listat aici. Poți elimina filtrul pentru a vedea celelalte locații." : "Poți elimina filtre sau alege altă localitate."}
      </p>
      {serviceFiltered && <button type="button" onClick={onClearServiceFilters} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-border px-6 text-sm font-medium hover:bg-secondary sm:w-auto">Vezi locațiile fără filtrul de servicii</button>}
      <Link
        to="/cerere"
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
      >
        Încearcă o căutare ghidată
      </Link>
    </div>
  );
}

function EmptyMatch({ locality, filtered }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center sm:col-span-2 sm:p-10">
      {filtered ? (
        <>
          <p className="font-heading font-bold">Nu am găsit rezultate pentru această căutare cu filtrele selectate.</p>
          <p className="mt-2 text-sm text-muted-foreground">Elimină un filtru de mai sus pentru a vedea mai multe opțiuni. Căutarea ta rămâne păstrată.</p>
        </>
      ) : locality ? (
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