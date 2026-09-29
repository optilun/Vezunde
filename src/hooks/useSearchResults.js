import { useEffect, useRef, useState } from "react";
import { invokeDirectoryBrowse } from "@/lib/directoryBrowse";
import { resolveServiceSearchQuery } from "@/lib/serviceSemanticSearch";
import { matchProvidersWithSemanticFallback } from "@/lib/providerSemanticSearch";
import { browsePublicProfessionals, matchProfessionalsForRequest } from "@/lib/professionalSearch";
import { RESULT_MODES } from "@/components/intake2/ResultModeTabs";

// Rezultatele din /cauta pentru o localitate: locatiile (rasfoire sau potrivire dupa serviciu),
// paginile urmatoare si specialistii.
//
// 2026-09-29 (audit /cauta, D3): mutat din Search.jsx, fara schimbari de comportament. Cererile,
// datele trimise catre potrivire si ordinea rezultatelor sunt aceleasi; pagina doar le afiseaza.
// `onCriteriaChange` se cheama cand criteriile se schimba (pagina sterge atunci selectia).
export default function useSearchResults({
  service, query, debouncedQuery, locality, providerType, filterServiceKeys, casOnly, searchMode, professionalType,
  hasCanonicalLocality, isDirectoryBrowse, typing, saved, onCriteriaChange,
}) {
  const [results, setResults] = useState(null);
  const [mapResults, setMapResults] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [directoryFilterContext, setDirectoryFilterContext] = useState(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const pageRequest = useRef(0);
  const [matchContext, setMatchContext] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [professionalError, setProfessionalError] = useState(false);
  const [professionals, setProfessionals] = useState(null);
  const [retry, setRetry] = useState(0);
  const criteriaChanged = useRef(onCriteriaChange);
  criteriaChanged.current = onCriteriaChange;

  const previousCriteria = useRef(null);
  // B1: cheia cererii ale carei rezultate sunt deja pe ecran. Aceeasi cheie = nimic de cerut din nou.
  const loadedKey = useRef(null);
  useEffect(() => {
    if (typing) return;
    const criteria = JSON.stringify([service, debouncedQuery, locality?.siruta_code, providerType, filterServiceKeys, casOnly]);
    // Aceleasi criterii (ex. „Arată rezultatele” fara nicio schimbare): nimic de resetat.
    if (previousCriteria.current === criteria) return;
    if (previousCriteria.current !== null) criteriaChanged.current?.();
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
    saved, // ultima cautare din sesiune; nu se schimba cat timp pagina e deschisa
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

  return {
    results, mapResults, pagination, directoryFilterContext, moreLoading, moreError, matchContext,
    loadError, professionals, professionalError, loadMore, retry: () => setRetry((value) => value + 1),
  };
}
