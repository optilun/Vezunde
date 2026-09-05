import React, { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  countyExpansionDraft,
  matchProvidersInSelectedCounty,
  matchProvidersNationally,
  nationalExpansionDraft,
} from "@/lib/patientSearchExpansion";
import {
  readPatientRequestDraft,
  storePatientRequestDraft,
} from "@/lib/patientRequestPersistenceClient";
import { clearPatientIntakeSession } from "@/lib/patientIntakeSession";
import { abandonAllPatientRequestIdempotency } from "@/lib/patientRequestIdempotency";
import MatchResultCard from "./MatchResultCard";
import NoResultsFlow from "./NoResultsFlow";
import ProfessionalResults from "./ProfessionalResults";
import ResultModeTabs, { RESULT_MODES } from "./ResultModeTabs";
import PatientRecoverySubmission from "./PatientRecoverySubmission";
import PatientRequestSubmission from "./PatientRequestSubmission";

function RoutingNotice({ meta }) {
  if (!meta?.routing_mode) return null;
  if (meta.routing_mode === "county" || meta.query_scope === "county") {
    return (
      <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Căutarea a fost extinsă la județul {meta.selected_county_name || "selectat"}, la cererea ta. Rezultatele din localitatea inițială și cele din restul județului sunt marcate separat.
      </div>
    );
  }
  if (meta.routing_mode === "locality") {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Am căutat după localitatea selectată: {meta.client_address_text || "localitate selectată"}.
      </div>
    );
  }
  return null;
}

function restartGuidedSearch() {
  clearPatientIntakeSession();
  abandonAllPatientRequestIdempotency();
  const params = new URLSearchParams(window.location.search);
  params.delete("ref");
  const query = params.toString();
  window.location.assign(`/cerere${query ? `?${query}` : ""}`);
}

function metaFromExpandedResponse(data, previousMeta) {
  return {
    ...previousMeta,
    recommendation_contract_version: data.recommendation_contract_version || previousMeta?.recommendation_contract_version || "legacy",
    routing_mode: data.routing_mode || "county",
    query_scope: data.query_scope || "county",
    routing_reason: data.routing_reason || "",
    coverage_status: data.coverage_status || null,
    coverage_counts: data.coverage_counts || null,
    need_level: data.need_level || previousMeta?.need_level || null,
    resolved_intent: data.resolved_intent || previousMeta?.resolved_intent || null,
    // 2026-09-03: dupa o extindere de arie, cheile rezolvate sunt cele ale raspunsului nou. Fara
    // linia asta, tabul de specialisti ar fi cerut in aria noua serviciile rezolvate in cea veche.
    resolved_service_keys: Array.isArray(data.resolved_service_keys)
      ? data.resolved_service_keys
      : (previousMeta?.resolved_service_keys || []),
    selected_locality_siruta_code: data.selected_locality_siruta_code || null,
    selected_locality_name: data.selected_locality_name || null,
    selected_county_code: data.selected_county_code || null,
    selected_county_name: data.selected_county_name || null,
    client_address_text: data.client_address_text || previousMeta?.client_address_text || "",
    used_semantic_fallback: false,
  };
}

function ResultScopeGroups({ items, queryScope, selectedCity, countyName, onSelectLocation, selectedId, compact = false }) {
  if (queryScope !== "county") {
    return (
      <div className="space-y-3">
        {items.map((location) => (
          <MatchResultCard
            key={location.id}
            location={location}
            onSelect={onSelectLocation}
            selected={selectedId === location.id}
            compact={compact}
          />
        ))}
      </div>
    );
  }

  const local = items.filter((item) => item.expansion_tier === "oras");
  const county = items.filter((item) => item.expansion_tier === "judet");
  const other = items.filter((item) => !["oras", "judet"].includes(item.expansion_tier));

  return (
    <div className="space-y-6">
      {local.length > 0 && (
        <section>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
            În {selectedCity || "localitatea selectată"}
          </div>
          <div className="space-y-3">
            {local.map((location) => (
              <MatchResultCard
                key={location.id}
                location={location}
                onSelect={onSelectLocation}
                selected={selectedId === location.id}
                compact={compact}
              />
            ))}
          </div>
        </section>
      )}
      {county.length > 0 && (
        <section>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">
            În restul județului {countyName || "selectat"}
          </div>
          <div className="space-y-3">
            {county.map((location) => (
              <MatchResultCard
                key={location.id}
                location={location}
                onSelect={onSelectLocation}
                selected={selectedId === location.id}
                compact={compact}
              />
            ))}
          </div>
        </section>
      )}
      {other.length > 0 && (
        <div className="space-y-3">
          {other.map((location) => (
            <MatchResultCard
              key={location.id}
              location={location}
              onSelect={onSelectLocation}
              selected={selectedId === location.id}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Module 3E: sections are driven STRICTLY by result_bucket from the backend.
// Top 3 = result_bucket === "top3" only — never a positional slice.
export default function MatchResults({
  results,
  meta,
  onChangeLocation = null,
  onReviewCriteria = null,
  onRequestCreated = null,
  onSelectLocation = null,
  selectedLocationId = null,
  compact = false,
  onVisibleResultsChange = null,
  onResultModeChange = null,
}) {
  const [showMore, setShowMore] = useState(false);
  const [feedback, setFeedback] = useState(null);
  // 2026-09-03: acelasi ecran raspunde acum la doua intrebari - "unde ma duc" si "la cine ma duc".
  // Modul este stare locala, nu ruta noua: contextul cererii (draft, meta, extinderi) ramane
  // acelasi si nu se pierde la comutare.
  const [resultMode, setResultMode] = useState(RESULT_MODES.locations.key);
  const [professionalCount, setProfessionalCount] = useState(null);
  const [expandedSnapshot, setExpandedSnapshot] = useState(null);
  const [isExpandingCounty, setIsExpandingCounty] = useState(false);
  const [expansionError, setExpansionError] = useState("");
  const [isExpandingNational, setIsExpandingNational] = useState(false);
  const [nationalExpansionError, setNationalExpansionError] = useState("");
  const lastImpressionKey = useRef("");
  const activeMeta = expandedSnapshot?.meta || meta || {};
  const list = Array.isArray(expandedSnapshot?.results)
    ? expandedSnapshot.results
    : (Array.isArray(results) ? results : []);
  const top3 = list.filter((result) => result.result_bucket === "top3");
  const confirmed = list.filter((result) => result.result_bucket === "extended_confirmed");
  const directory = list.filter((result) => result.result_bucket === "extended_directory");
  // Profiluri din director fara servicii declarate, afisate doar cand nu exista optiuni mai bune.
  const structural = list.filter((result) => result.result_bucket === "structural_directory");
  const structuralCapability = structural[0]?.structural_capability || null;
  const moreCount = confirmed.length + directory.length + structural.length;
  const recommendationState = top3.length === 0 && moreCount === 0 ? "empty" : (top3.length < 3 ? "insufficient" : "sufficient");
  const queryScope = activeMeta.query_scope || activeMeta.routing_mode || "locality";
  const storedDraft = readPatientRequestDraft();
  const countyName = activeMeta.selected_county_name || storedDraft?.county || "";
  const selectedCity = activeMeta.selected_locality_name || storedDraft?.city || "";

  // Harta traieste in pagina parinte, dar setul de rezultate se poate schimba aici: o extindere
  // in judet sau in tara inlocuieste lista fara sa treaca prin props. Fara linia asta, harta ar
  // ramane pe rezultatele initiale si ar arata alta realitate decat lista de langa ea.
  useEffect(() => {
    if (onVisibleResultsChange) onVisibleResultsChange(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);

  useEffect(() => {
    if (onResultModeChange) onResultModeChange(resultMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultMode]);

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
          resolved_intent: activeMeta?.resolved_intent || "unknown",
          used_semantic_fallback: activeMeta?.used_semantic_fallback === true,
          result_count: list.length,
          top3_count: top3.length,
          confirmed_count: confirmed.length,
          directory_count: directory.length,
          local_provider_count: Number(activeMeta?.coverage_counts?.local_provider_count) || 0,
          scope_provider_count: Number(activeMeta?.coverage_counts?.scope_provider_count) || 0,
          configured_matching_provider_count: Number(activeMeta?.coverage_counts?.configured_matching_provider_count) || 0,
          eligible_provider_count: Number(activeMeta?.coverage_counts?.eligible_provider_count) || 0,
        },
      });
    } catch (_error) {
      // Recommendation display must not depend on analytics.
    }
  }, [activeMeta, confirmed.length, directory.length, list, queryScope, recommendationState, top3.length]);

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
          top3_count: top3.length,
        },
      });
    } catch (_error) {
      // Recovery actions must remain available without analytics.
    }
    if (callback) callback();
    else restartGuidedSearch();
  };

  const expandCounty = async () => {
    if (isExpandingCounty || queryScope === "county") return;
    const draft = readPatientRequestDraft();
    if (!draft) {
      setExpansionError("Rezumatul cererii nu mai este disponibil. Reia căutarea.");
      return;
    }

    setIsExpandingCounty(true);
    setExpansionError("");
    try {
      base44.analytics.track({
        eventName: "patient_search_county_expansion_started",
        properties: {
          analytics_version: "patient-search-v1",
          expansion_version: "patient-county-expansion-v1",
          original_coverage_status: activeMeta?.coverage_status || "unknown",
          original_result_count: list.length,
          county_code: draft.county_code || "unknown",
        },
      });
    } catch (_error) {
      // Expansion must not depend on analytics.
    }

    try {
      const data = await matchProvidersInSelectedCounty(draft);
      const nextDraft = countyExpansionDraft(draft, data);
      storePatientRequestDraft(nextDraft);
      const nextMeta = metaFromExpandedResponse(data, activeMeta);
      setExpandedSnapshot({ results: Array.isArray(data.results) ? data.results : [], meta: nextMeta });
      setShowMore(false);
      try {
        base44.analytics.track({
          eventName: "patient_search_county_expansion_completed",
          properties: {
            analytics_version: "patient-search-v1",
            expansion_version: "patient-county-expansion-v1",
            coverage_status: data.coverage_status || "unknown",
            result_count: data.results?.length || 0,
            local_result_count: Number(data.coverage_counts?.local_eligible_provider_count) || 0,
            county_result_count: Number(data.coverage_counts?.county_eligible_provider_count) || 0,
          },
        });
      } catch (_error) {
        // Expansion must not depend on analytics.
      }
    } catch (error) {
      setExpansionError(error?.message || "Căutarea nu a putut fi extinsă în județ.");
      try {
        base44.analytics.track({
          eventName: "patient_search_county_expansion_failed",
          properties: {
            analytics_version: "patient-search-v1",
            expansion_version: "patient-county-expansion-v1",
          },
        });
      } catch (_error) {
        // Expansion must not depend on analytics.
      }
    } finally {
      setIsExpandingCounty(false);
    }
  };

  const expandNational = async () => {
    if (isExpandingNational || queryScope === "national") return;
    const draft = readPatientRequestDraft();
    if (!draft) {
      setNationalExpansionError("Rezumatul cererii nu mai este disponibil. Reia căutarea.");
      return;
    }

    setIsExpandingNational(true);
    setNationalExpansionError("");
    try {
      base44.analytics.track({
        eventName: "patient_search_national_expansion_started",
        properties: {
          analytics_version: "patient-search-v1",
          expansion_version: "patient-national-expansion-v1",
          original_coverage_status: activeMeta?.coverage_status || "unknown",
          original_result_count: list.length,
        },
      });
    } catch (_error) {
      // Expansion must not depend on analytics.
    }

    try {
      const data = await matchProvidersNationally(draft);
      const nextDraft = nationalExpansionDraft(draft);
      storePatientRequestDraft(nextDraft);
      const nextMeta = metaFromExpandedResponse(data, activeMeta);
      setExpandedSnapshot({ results: Array.isArray(data.results) ? data.results : [], meta: nextMeta });
      setShowMore(false);
      try {
        base44.analytics.track({
          eventName: "patient_search_national_expansion_completed",
          properties: {
            analytics_version: "patient-search-v1",
            expansion_version: "patient-national-expansion-v1",
            coverage_status: data.coverage_status || "unknown",
            result_count: data.results?.length || 0,
          },
        });
      } catch (_error) {
        // Expansion must not depend on analytics.
      }
    } catch (error) {
      setNationalExpansionError(error?.message || "Căutarea nu a putut fi extinsă la nivel național.");
      try {
        base44.analytics.track({
          eventName: "patient_search_national_expansion_failed",
          properties: {
            analytics_version: "patient-search-v1",
            expansion_version: "patient-national-expansion-v1",
          },
        });
      } catch (_error) {
        // Expansion must not depend on analytics.
      }
    } finally {
      setIsExpandingNational(false);
    }
  };

  const expansionProps = {
    countyName,
    onExpandCounty: queryScope === "county" || !countyName ? undefined : expandCounty,
    isExpandingCounty,
    actionError: expansionError,
    onExpandNational: queryScope === "national" ? undefined : expandNational,
    isExpandingNational,
    nationalActionError: nationalExpansionError,
  };

  if (top3.length === 0 && moreCount === 0) {
    // Zero locatii nu inseamna zero specialisti: pot exista profiluri verificate asociate unor
    // locatii care nu au declarat inca serviciul cautat. Selectorul ramane disponibil si aici.
    if (resultMode === RESULT_MODES.professionals.key) {
      return (
        <div>
          <div className="mb-6">
            <ResultModeTabs
              mode={resultMode}
              onChange={changeResultMode}
              counts={{ locations: 0, professionals: professionalCount }}
            />
          </div>
          <ProfessionalResults
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
        <div className="mb-6">
          <ResultModeTabs
            mode={resultMode}
            onChange={changeResultMode}
            counts={{ locations: 0, professionals: professionalCount }}
          />
        </div>
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

  const expanded = showMore || top3.length === 0;

  const modeTabs = (
    <div className="mb-6">
      <ResultModeTabs
        mode={resultMode}
        onChange={changeResultMode}
        counts={{ locations: list.length, professionals: professionalCount }}
      />
    </div>
  );

  if (resultMode === RESULT_MODES.professionals.key) {
    return (
      <div>
        {modeTabs}
        <ProfessionalResults
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
      {modeTabs}
      {top3.length > 0 && (
        <>
          <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Cele mai potrivite opțiuni</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Selectate pe baza serviciilor confirmate, relevanței căutării și verificării profilului în aria aleasă.
          </p>
          <RoutingNotice meta={activeMeta} />
          <div className="mt-5">
            <ResultScopeGroups items={top3} queryScope={queryScope} selectedCity={selectedCity} countyName={countyName} onSelectLocation={onSelectLocation} selectedId={selectedLocationId} compact={compact} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <a href="/cauta" className="font-medium text-foreground underline underline-offset-2">
              Vezi toate opțiunile din zonă
            </a>
            {expansionProps.onExpandCounty && (
              <button
                type="button"
                onClick={expandCounty}
                disabled={isExpandingCounty}
                className="font-medium text-foreground underline underline-offset-2 disabled:opacity-60"
              >
                {isExpandingCounty ? "Extindem..." : `Extinde în județul ${countyName || "selectat"}`}
              </button>
            )}
            {expansionProps.onExpandNational && (
              <button
                type="button"
                onClick={expandNational}
                disabled={isExpandingNational}
                className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2 disabled:opacity-60"
              >
                <Globe className="h-3 w-3" />
                {isExpandingNational ? "Căutăm în toată țara..." : "Caută în toată țara"}
              </button>
            )}
          </div>
          {(expansionError || nationalExpansionError) && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {expansionError || nationalExpansionError}
            </p>
          )}
        </>
      )}

      {top3.length < 3 && (
        <div className={top3.length > 0 ? "mt-6" : ""}>
          <NoResultsFlow
            mode="insufficient"
            meta={activeMeta}
            top3Count={top3.length}
            directoryCount={directory.length}
            onChangeLocation={() => runRecoveryAction("change_location", onChangeLocation)}
            onReviewCriteria={() => runRecoveryAction("review_criteria", onReviewCriteria)}
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

      {expanded && confirmed.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mai multe opțiuni relevante</div>
          <div className="mt-3">
            <ResultScopeGroups items={confirmed} queryScope={queryScope} selectedCity={selectedCity} countyName={countyName} onSelectLocation={onSelectLocation} selectedId={selectedLocationId} compact={compact} />
          </div>
        </div>
      )}

      {expanded && directory.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Opțiuni din director</div>
          <div className="mt-3">
            <ResultScopeGroups items={directory} queryScope={queryScope} selectedCity={selectedCity} countyName={countyName} onSelectLocation={onSelectLocation} selectedId={selectedLocationId} compact={compact} />
          </div>
        </div>
      )}

      {expanded && structural.length > 0 && (
        <div className="mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
              {structural[0]?.structural_group_label
                || (structuralCapability === "medical"
                  ? "Alte cabinete și clinici oftalmologice din zonă"
                  : "Alte optici din zonă")}
            </div>
            <a href="/adauga-sau-revendica" className="text-[11px] font-medium text-foreground underline underline-offset-2">
              Sunteți reprezentantul uneia dintre acestea?
            </a>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {structuralCapability === "medical"
              ? "Servicii neconfirmate de furnizor — sunați înainte să mergeti."
              : "Servicii neconfirmate de furnizor — confirmați telefonic înainte de deplasare."}
          </p>
          <div className="mt-3">
            <ResultScopeGroups items={structural} queryScope={queryScope} selectedCity={selectedCity} countyName={countyName} onSelectLocation={onSelectLocation} selectedId={selectedLocationId} compact={compact} />
          </div>
        </div>
      )}

      <PatientRequestSubmission results={list} meta={activeMeta} onRequestCreated={onRequestCreated} />

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
  );
}
