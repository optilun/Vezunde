import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { clearPatientIntakeSession } from "@/lib/patientIntakeSession";
import { abandonAllPatientRequestIdempotency } from "@/lib/patientRequestIdempotency";
import ResultScopeGroups from "./ResultScopeGroups";
import RecommendationExtendedSections from "./RecommendationExtendedSections";
import useRecommendationExpansion from "@/hooks/useRecommendationExpansion";
import { groupStructural, splitByBucket } from "@/lib/recommendationSections";
import NoResultsFlow from "./NoResultsFlow";
import ProfessionalResults from "./ProfessionalResults";
import ResultModeTabs, { RESULT_MODES } from "./ResultModeTabs";
import InfoHint from "./InfoHint";
import RecommendationToolbar from "./RecommendationToolbar";
import { DIRECTORY_PROVIDER_FILTER_LABELS } from "@/lib/vezunde";
import {
  NO_FILTERS,
  applyRecommendationFilters,
  countActiveFilters,
  normalizeFilters,
  trustedCountFor,
  typeCountsFor,
} from "@/lib/recommendationFilters";
import PatientRecoverySubmission from "./PatientRecoverySubmission";
import PatientRequestSubmission from "./PatientRequestSubmission";


function restartGuidedSearch() {
  clearPatientIntakeSession();
  abandonAllPatientRequestIdempotency();
  const params = new URLSearchParams(window.location.search);
  params.delete("ref");
  const query = params.toString();
  window.location.assign(`/cerere${query ? `?${query}` : ""}`);
}

// Module 3E: sections are driven STRICTLY by result_bucket from the backend.
// Top 3 = result_bucket === "top3" only — never a positional slice.
export default function MatchResults({
  results,
  meta,
  initialResultMode = "locations",
  initialShowMore = false,
  onChangeLocation = null,
  onReviewCriteria = null,
  onRequestCreated = null,
  onSelectLocation = null,
  selectedLocationId = null,
  compact = false,
  hideRequestSubmission = false,
  onVisibleResultsChange = null,
  onResultModeChange = null,
  onContextChange = null,
  onExpandedSnapshot = null,
  onHoverLocation = null,
  hoveredLocationId = null,
  visibleIds = null,
  mappedLocationIds = null,
  onClearViewport = null,
  initialFilters = null,
  onFiltersChange = null,
  onFilteredResultsChange = null,
}) {
  const [showMore, setShowMore] = useState(initialShowMore);
  const [feedback, setFeedback] = useState(null);
  // 2026-09-30. Filtrele listei (tip, profil) si meniul zonei. Filtrele se pastreaza in pagina
  // parinte (initialFilters / onFiltersChange), ca dupa o vizita pe un profil sa fie tot acolo.
  const [filters, setFilters] = useState(() => normalizeFilters(initialFilters));
  const [zoneOpen, setZoneOpen] = useState(false);
  // 2026-09-03: acelasi ecran raspunde acum la doua intrebari - "unde ma duc" si "la cine ma duc".
  // Modul este stare locala, nu ruta noua: contextul cererii (draft, meta, extinderi) ramane
  // acelasi si nu se pierde la comutare.
  const [resultMode, setResultMode] = useState(initialResultMode === "professionals" ? "professionals" : "locations");
  const [professionalCount, setProfessionalCount] = useState(null);
  // 2026-09-30. Extinderea zonei (judet / tara), lista si meta-ul dupa extindere stau in hook.
  const {
    activeMeta, list, queryScope, storedDraft, countyName, selectedCity,
    expansionProps, isExpandingCounty, isExpandingNational, expansionError, nationalExpansionError,
  } = useRecommendationExpansion({
    meta,
    results,
    onExpandedSnapshot,
    // Dupa o extindere reusita lista e alta: „mai multe optiuni” se inchide, la fel meniul zonei.
    onExpanded: () => { setShowMore(false); setZoneOpen(false); },
  });
  const lastImpressionKey = useRef("");
  // 2026-09-05. Filtrarea la ce se vede pe harta este PUR VIZUALA. Ascunde carduri; nu
  // recalculeaza nimic. Bucketul, rangul si ordinea fiecarui rezultat raman exact cele primite
  // de la server, iar cererea se trimite in continuare pe baza listei complete (`list`), nu a
  // celei filtrate - altfel o simpla deplasare a hartii ar schimba cine primeste cererea.
  const visibleSet = Array.isArray(visibleIds) ? new Set(visibleIds) : null;
  const shownList = visibleSet ? list.filter((result) => visibleSet.has(result.id)) : list;
  // 2026-09-30. Filtrele de tip si de profil sunt, ca filtrul de harta, PUR VIZUALE: ascund carduri
  // dintr-o lista primita, in ordinea primita. Nu cheama serverul, nu schimba bucketul sau rangul,
  // iar cererea se trimite in continuare pe lista completa (`list`).
  const filteredList = applyRecommendationFilters(shownList, filters);

  const { top3, confirmed, directory, structural } = splitByBucket(filteredList);
  const structuralGroups = groupStructural(structural);
  const moreCount = confirmed.length + directory.length + structural.length;
  // Starea recomandarii descrie ce a gasit serverul, nu cat se vede acum pe ecran: o deplasare
  // a hartii nu are voie sa declanseze fluxul de recuperare "nu am gasit nimic".
  const serverTop3Count = list.filter((result) => result.result_bucket === "top3").length;
  const recommendationState = list.length === 0
    ? "empty"
    : (serverTop3Count < 3 ? "insufficient" : "sufficient");

  // Harta traieste in pagina parinte, dar setul de rezultate se poate schimba aici: o extindere
  // in judet sau in tara inlocuieste lista fara sa treaca prin props. Fara linia asta, harta ar
  // ramane pe rezultatele initiale si ar arata alta realitate decat lista de langa ea.
  // 2026-09-29 (lint exhaustive-deps): efectele ruleaza tot la schimbarea listei / a modului si
  // cheama ultima functie primita de la pagina (nu cea de la prima randare).
  const visibleResultsChanged = useRef(onVisibleResultsChange);
  visibleResultsChanged.current = onVisibleResultsChange;
  const resultModeChanged = useRef(onResultModeChange);
  resultModeChanged.current = onResultModeChange;
  useEffect(() => {
    visibleResultsChanged.current?.(list);
  }, [list]);

  useEffect(() => {
    resultModeChanged.current?.(resultMode);
  }, [resultMode]);

  // 2026-09-30. Pinii recomandarilor de pe harta urmeaza filtrele din bara: un card ascuns nu
  // ramane pin evidentiat. Se trimite doar lista pentru HARTA (null = fara filtre active sau alt
  // mod, adica lista completa); pagina o foloseste numai la pini. Cererea, numarul din antet si
  // starea recomandarii raman pe lista completa (`list`), iar ordinea nu se schimba.
  const filteredForMap = useMemo(
    () => (resultMode === RESULT_MODES.locations.key && countActiveFilters(filters) > 0
      ? applyRecommendationFilters(list, filters)
      : null),
    [list, filters, resultMode],
  );
  const filteredForMapChanged = useRef(onFilteredResultsChange);
  filteredForMapChanged.current = onFilteredResultsChange;
  useEffect(() => {
    filteredForMapChanged.current?.(filteredForMap);
  }, [filteredForMap]);

  useEffect(() => { onContextChange?.(activeMeta); }, [activeMeta, onContextChange]);
  useEffect(() => {
    if (selectedLocationId && list.some(row => row.id === selectedLocationId && row.result_bucket !== "top3")) setShowMore(true);
  }, [selectedLocationId, list]);

  useEffect(() => {
    if (list.length === 0 && !activeMeta?.coverage_status) return;
    const impressionKey = list.length > 0
      ? list.map((item) => `${item.id}:${item.result_bucket}:${item.bucket_rank}:${item.expansion_tier || "oras"}`).join("|")
      : `empty:${activeMeta?.coverage_status || "unknown"}:${queryScope}`;
    if (!impressionKey || impressionKey === lastImpressionKey.current) return;
    lastImpressionKey.current = impressionKey;
    setFeedback(null);
    try {
      base44.analytics.track({
        eventName: "provider_recommendation_results_viewed",
        properties: {
          analytics_version: "patient-search-v1",
          contract_version: activeMeta?.recommendation_contract_version || list[0]?.recommendation_contract_version || "legacy",
          coverage_status: activeMeta?.coverage_status || "unknown",
          recommendation_state: recommendationState,
          query_scope: queryScope,
          need_level: activeMeta?.need_level || "unknown",
          provider_type_mode: activeMeta?.provider_type_preference?.mode || "unknown",
          resolved_intent: activeMeta?.resolved_intent || "unknown",
          used_semantic_fallback: activeMeta?.used_semantic_fallback === true,
          result_count: list.length,
          top3_count: serverTop3Count,
          confirmed_count: list.filter(row => row.result_bucket === "extended_confirmed").length,
          directory_count: list.filter(row => row.result_bucket === "extended_directory").length,
          local_provider_count: Number(activeMeta?.coverage_counts?.local_provider_count) || 0,
          scope_provider_count: Number(activeMeta?.coverage_counts?.scope_provider_count) || 0,
          configured_matching_provider_count: Number(activeMeta?.coverage_counts?.configured_matching_provider_count) || 0,
          eligible_provider_count: Number(activeMeta?.coverage_counts?.eligible_provider_count) || 0,
        },
      });
    } catch (_error) {
      // Recommendation display must not depend on analytics.
    }
  }, [activeMeta, confirmed.length, directory.length, list, queryScope, recommendationState, serverTop3Count, top3.length]);

  const submitFeedback = (useful) => {
    if (feedback !== null) return;
    setFeedback(useful);
    try {
      base44.analytics.track({
        eventName: "provider_recommendation_feedback_submitted",
        properties: {
          analytics_version: "patient-search-v1",
          contract_version: activeMeta?.recommendation_contract_version || list[0]?.recommendation_contract_version || "legacy",
          coverage_status: activeMeta?.coverage_status || "unknown",
          resolved_intent: activeMeta?.resolved_intent || "unknown",
          query_scope: queryScope,
          result_count: list.length,
          useful,
        },
      });
    } catch (_error) {
      // Feedback UI remains usable if analytics is unavailable.
    }
  };

  const changeResultMode = (nextMode) => {
    if (nextMode === resultMode) return;
    setResultMode(nextMode);
    try {
      base44.analytics.track({
        eventName: "recommendation_mode_changed",
        properties: {
          analytics_version: "patient-search-v1",
          mode: nextMode,
          query_scope: queryScope,
          need_level: activeMeta?.need_level || "unknown",
          location_result_count: list.length,
        },
      });
    } catch (_error) {
      // Comutarea nu depinde de analitica.
    }
  };

  const runRecoveryAction = (action, callback) => {
    try {
      base44.analytics.track({
        eventName: "patient_search_recovery_action_clicked",
        properties: {
          analytics_version: "patient-search-v1",
          action,
          recommendation_state: recommendationState,
          query_scope: queryScope,
          coverage_status: activeMeta?.coverage_status || "unknown",
          result_count: list.length,
          top3_count: serverTop3Count,
        },
      });
    } catch (_error) {
      // Recovery actions must remain available without analytics.
    }
    if (callback) callback();
    else restartGuidedSearch();
  };

  const changeFilters = (next) => {
    const normalized = normalizeFilters(next);
    setFilters(normalized);
    onFiltersChange?.(normalized);
    try {
      base44.analytics.track({
        eventName: "recommendation_filters_changed",
        properties: {
          analytics_version: "patient-search-v1",
          active_filter_count: countActiveFilters(normalized),
          type_filter_count: normalized.types.length,
          trusted_only: normalized.trustedOnly,
          result_count: list.length,
          shown_count: applyRecommendationFilters(shownList, normalized).length,
        },
      });
    } catch (_error) {
      // Filtrele nu depind de analitica.
    }
  };
  const clearFilters = () => {
    if (countActiveFilters(filters) > 0) changeFilters(NO_FILTERS);
    if (visibleSet) onClearViewport?.();
  };

  // 2026-09-30. Filele, zona si filtrele stau intr-o singura bara compacta deasupra listei.
  // Extinderea zonei cheama aceleasi functii ca inainte (expandCounty / expandNational).
  const modeTabs = (
    <ResultModeTabs
      compact
      mode={resultMode}
      onChange={changeResultMode}
      counts={{ locations: list.length, professionals: professionalCount }}
    />
  );
  const zone = {
    scope: queryScope,
    cityName: selectedCity,
    countyName,
    open: zoneOpen,
    onOpenChange: setZoneOpen,
    busyScope: isExpandingCounty ? "county" : isExpandingNational ? "national" : null,
    error: expansionError || nationalExpansionError,
    onExpandCounty: expansionProps.onExpandCounty,
    onExpandNational: expansionProps.onExpandNational,
    onChangeLocation: () => runRecoveryAction("change_location", onChangeLocation),
    onReviewCriteria: () => runRecoveryAction("review_criteria", onReviewCriteria),
  };

  if (list.length === 0) {
    // Zero locatii nu inseamna zero specialisti: pot exista profiluri verificate asociate unor
    // locatii care nu au declarat inca serviciul cautat. Selectorul ramane disponibil si aici.
    if (resultMode === RESULT_MODES.professionals.key) {
      return (
        <div>
          <RecommendationToolbar sticky={compact} modeTabs={modeTabs} zone={zone} />
          <ProfessionalResults initialShowMore={initialShowMore}
            meta={activeMeta}
            draft={storedDraft}
            onBackToLocations={() => changeResultMode(RESULT_MODES.locations.key)}
            onCountChange={setProfessionalCount}
          />
        </div>
      );
    }
    return (
      <div>
        <RecommendationToolbar sticky={compact} modeTabs={modeTabs} zone={zone} />
        <NoResultsFlow
          mode="empty"
          meta={activeMeta}
          top3Count={0}
          directoryCount={0}
          onChangeLocation={() => runRecoveryAction("change_location", onChangeLocation)}
          onReviewCriteria={() => runRecoveryAction("review_criteria", onReviewCriteria)}
          {...expansionProps}
        />
        <PatientRecoverySubmission meta={activeMeta} />
      </div>
    );
  }

  const expanded = showMore || top3.length === 0 || shownList.some(row => row.id === selectedLocationId && row.result_bucket !== "top3");

  const locationsMode = resultMode === RESULT_MODES.locations.key;
  const activeChips = locationsMode ? [
    ...filters.types.map((key) => ({
      key: `type:${key}`,
      label: DIRECTORY_PROVIDER_FILTER_LABELS[key] || key,
      remove: () => changeFilters({ ...filters, types: filters.types.filter((value) => value !== key) }),
    })),
    ...(filters.trustedOnly ? [{ key: "trusted", label: "Verificate sau revendicate", remove: () => changeFilters({ ...filters, trustedOnly: false }) }] : []),
    ...(visibleSet && onClearViewport ? [{ key: "viewport", label: "Doar zona de pe hartă", remove: onClearViewport }] : []),
  ] : [];
  const hiddenCount = list.length - filteredList.length;
  // Cand filtrele ascund optiuni, se spune cate si de ce. O lista scurtata in tacere ar parea un
  // rezultat al cererii, nu al filtrelor sau al deplasarii hartii.
  const summary = hiddenCount > 0 ? `${filteredList.length} din ${list.length} opțiuni` : "";
  const toolbar = (
    <RecommendationToolbar
      sticky={compact}
      modeTabs={modeTabs}
      zone={zone}
      filters={locationsMode ? {
        filters,
        onChange: changeFilters,
        typeOptions: typeCountsFor(list, filters),
        trustedCount: trustedCountFor(list),
        totalCount: list.length,
        shownCount: applyRecommendationFilters(list, filters).length,
      } : null}
      activeChips={activeChips}
      summary={summary}
      onClearAll={activeChips.length > 0 ? clearFilters : null}
    />
  );

  return (
    <div>
      {toolbar}
      {!zoneOpen && (expansionError || nationalExpansionError) && (
        <p role="alert" className="mb-3 text-xs text-destructive">{expansionError || nationalExpansionError}</p>
      )}
      {resultMode === RESULT_MODES.professionals.key && <ProfessionalResults initialShowMore={initialShowMore} meta={activeMeta} draft={storedDraft} onBackToLocations={() => changeResultMode(RESULT_MODES.locations.key)} onCountChange={setProfessionalCount} />}
      {/* Cat dureaza o extindere de arie, lista ramane la locul ei, estompata si marcata ca ocupata. */}
      <div
        hidden={resultMode !== RESULT_MODES.locations.key}
        aria-busy={isExpandingCounty || isExpandingNational}
        className={`transition-opacity duration-200 ${isExpandingCounty || isExpandingNational ? "opacity-60" : ""}`}
      >

      {list.length > 0 && filteredList.length === 0 && (
        <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm">
          <p className="font-semibold">Nicio opțiune cu filtrele alese.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {list.length} {list.length === 1 ? "opțiune rămâne" : "opțiuni rămân"} în lista completă a cererii.
          </p>
          <button type="button" onClick={clearFilters} className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-[#4f6080] underline underline-offset-4">Afișează toate rezultatele cererii</button>
        </div>
      )}

      {top3.length > 0 && (
        <>
          <div className="flex items-center">
            <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Cele mai potrivite opțiuni</h2>
            <InfoHint
              label="Cum sunt alese recomandările?"
              items={["Selectate dintre locațiile care primesc cereri prin VIASEE, pe baza serviciilor confirmate, relevanței cererii și verificării profilului în aria aleasă. Plata nu influențează ordinea. Afișăm până la trei recomandări, doar când există opțiuni eligibile."]}
            />
          </div>
          <div className="mt-3">
            <ResultScopeGroups items={top3} queryScope={queryScope} selectedCity={selectedCity} countyName={countyName} onSelectLocation={onSelectLocation} selectedId={selectedLocationId} onHoverLocation={onHoverLocation} hoveredId={hoveredLocationId} mappedLocationIds={mappedLocationIds} />
          </div>
        </>
      )}

      {serverTop3Count < 3 && (
        <div className={top3.length > 0 ? "mt-6" : ""}>
          <NoResultsFlow
            mode="insufficient"
            compact={compact}
            meta={activeMeta}
            top3Count={serverTop3Count}
            directoryCount={list.filter(row => row.result_bucket === "extended_directory").length}
            onChangeLocation={() => runRecoveryAction("change_location", onChangeLocation)}
            onReviewCriteria={() => runRecoveryAction("review_criteria", onReviewCriteria)}
            onOpenZone={() => setZoneOpen(true)}
            {...expansionProps}
          />
        </div>
      )}

      {moreCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="mt-6 min-h-12 w-full rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/40"
        >
          Vezi mai multe opțiuni ({moreCount})
        </button>
      )}

      {expanded && (
        <RecommendationExtendedSections
          confirmed={confirmed}
          directory={directory}
          structuralGroups={structuralGroups}
          groupProps={{ queryScope, selectedCity, countyName, onSelectLocation, selectedId: selectedLocationId, onHoverLocation, hoveredId: hoveredLocationId, mappedLocationIds }}
        />
      )}

      {!hideRequestSubmission && <section data-request-followup tabIndex={-1} aria-label="Cererea și conversațiile tale" className="mt-6 rounded-[22px] border border-border bg-card p-4 sm:p-5">
        <h2 className="font-heading text-lg font-bold">Cererea și conversațiile tale</h2>
        <p className="mt-1 text-sm text-muted-foreground">Continuă cu o cerere pentru a primi răspunsuri de la locații. Conversațiile apar aici, în fluxul cererii.</p>
        <PatientRequestSubmission results={list} meta={activeMeta} onRequestCreated={onRequestCreated} />
      </section>}

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
        VIASEE nu oferă diagnostic medical. Ordinea rezultatelor reflectă serviciile confirmate și verificarea profilului.
      </p>

      <div className="mt-5 flex flex-col items-stretch gap-2 border-t border-border pt-4 sm:flex-row sm:items-center">
        {feedback === null ? (
          <>
            <span className="text-xs font-medium text-foreground sm:mr-1">Ți-au fost utile recomandările?</span>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                onClick={() => submitFeedback(true)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-xs font-medium hover:border-foreground/40"
              >
                Da
              </button>
              <button
                type="button"
                onClick={() => submitFeedback(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-xs font-medium hover:border-foreground/40"
              >
                Nu
              </button>
            </div>
          </>
        ) : (
          <span className="text-xs leading-relaxed text-muted-foreground">Mulțumim. Feedbackul tău ne ajută să îmbunătățim recomandările.</span>
        )}
      </div>
      </div>
    </div>
  );
}
