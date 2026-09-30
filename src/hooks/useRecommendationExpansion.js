import { useEffect, useMemo, useRef, useState } from "react";
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

// Extinderea zonei recomandarilor (2026-09-30). Mutata din MatchResults.jsx, fara schimbari de
// comportament: acelasi apel catre server (judet / tara), aceleasi evenimente de analitica, aceleasi
// stari de ocupat si de eroare. Aici sta tot ce tine de LISTA si de META-ul ei dupa o extindere; lista
// primita de la pagina ramane punctul de plecare, iar o extindere o inlocuieste (`expandedSnapshot`).
//
// Nu se calculeaza nimic despre potrivire: rezultatele si ordinea vin de la server, exact ca inainte.

const EMPTY_META = Object.freeze({});
// 2026-09-29 (lint exhaustive-deps): aceeasi lista goala intre randari. Un `[]` nou la fiecare
// randare schimba `list`, iar efectul care anunta pagina (harta) rula din nou la fiecare randare.
const NO_RESULTS = Object.freeze([]);

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
    provider_type_preference: data.provider_type_preference || previousMeta?.provider_type_preference || null,
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

/**
 * @param {object} params
 * @param {object} params.meta               contextul cererii primit de la pagina
 * @param {Array}  params.results            rezultatele primite de la pagina
 * @param {Function} [params.onExpandedSnapshot]  anunta pagina ca lista a fost inlocuita (o salveaza in stare)
 * @param {Function} [params.onExpanded]     apelata dupa o extindere reusita (ecranul inchide „mai multe” si meniul zonei)
 */
export default function useRecommendationExpansion({ meta, results, onExpandedSnapshot = null, onExpanded = null }) {
  const [expandedSnapshot, setExpandedSnapshot] = useState(null);
  const [isExpandingCounty, setIsExpandingCounty] = useState(false);
  const [expansionError, setExpansionError] = useState("");
  const [isExpandingNational, setIsExpandingNational] = useState(false);
  const [nationalExpansionError, setNationalExpansionError] = useState("");
  const expansionBusy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  // Ultima functie primita de la ecran (nu cea de la prima randare).
  const expandedCallback = useRef(onExpanded);
  expandedCallback.current = onExpanded;
  const activeMeta = expandedSnapshot?.meta || meta || EMPTY_META;
  const list = useMemo(() => (Array.isArray(expandedSnapshot?.results)
    ? expandedSnapshot.results
    : (Array.isArray(results) ? results : NO_RESULTS)), [expandedSnapshot, results]);
  const queryScope = activeMeta.query_scope || activeMeta.routing_mode || "locality";
  const storedDraft = readPatientRequestDraft();
  const countyName = activeMeta.selected_county_name || storedDraft?.county || "";
  const selectedCity = activeMeta.selected_locality_name || storedDraft?.city || "";

  const expandCounty = async () => {
    if (expansionBusy.current || queryScope === "county") return;
    const draft = readPatientRequestDraft();
    if (!draft) {
      setExpansionError("Rezumatul cererii nu mai este disponibil. Reia căutarea.");
      return;
    }

    expansionBusy.current = true;
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
      if (!mounted.current) return;
      const nextDraft = countyExpansionDraft(draft, data);
      storePatientRequestDraft(nextDraft);
      const nextMeta = metaFromExpandedResponse(data, activeMeta);
      const snapshot = { results: Array.isArray(data.results) ? data.results : [], meta: nextMeta };
      setExpandedSnapshot(snapshot);
      onExpandedSnapshot?.(snapshot);
      expandedCallback.current?.();
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
      expansionBusy.current = false;
      setIsExpandingCounty(false);
    }
  };

  const expandNational = async () => {
    if (expansionBusy.current || queryScope === "national") return;
    const draft = readPatientRequestDraft();
    if (!draft) {
      setNationalExpansionError("Rezumatul cererii nu mai este disponibil. Reia căutarea.");
      return;
    }

    expansionBusy.current = true;
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
      if (!mounted.current) return;
      const nextDraft = nationalExpansionDraft(draft);
      storePatientRequestDraft(nextDraft);
      const nextMeta = metaFromExpandedResponse(data, activeMeta);
      const snapshot = { results: Array.isArray(data.results) ? data.results : [], meta: nextMeta };
      setExpandedSnapshot(snapshot);
      onExpandedSnapshot?.(snapshot);
      expandedCallback.current?.();
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
      expansionBusy.current = false;
      setIsExpandingNational(false);
    }
  };

  const expansionProps = {
    countyName,
    onExpandCounty: queryScope === "county" || !countyName ? undefined : expandCounty,
    isExpandingCounty: isExpandingCounty || isExpandingNational,
    actionError: expansionError,
    onExpandNational: queryScope === "national" ? undefined : expandNational,
    isExpandingNational: isExpandingCounty || isExpandingNational,
    nationalActionError: nationalExpansionError,
  };

  return {
    expandedSnapshot,
    activeMeta,
    list,
    queryScope,
    storedDraft,
    countyName,
    selectedCity,
    expansionProps,
    isExpandingCounty,
    isExpandingNational,
    expansionError,
    nationalExpansionError,
  };
}
