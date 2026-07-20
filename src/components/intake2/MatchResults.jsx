import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import MatchResultCard from "./MatchResultCard";
import NoResultsFlow from "./NoResultsFlow";
import PatientRequestSubmission from "./PatientRequestSubmission";

function RoutingNotice({ meta }) {
  if (!meta?.routing_mode) return null;
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
  const params = new URLSearchParams(window.location.search);
  params.delete("ref");
  const query = params.toString();
  window.location.assign(`/cerere${query ? `?${query}` : ""}`);
}

// Module 3E: sections are driven STRICTLY by result_bucket from the backend.
// Top 3 = result_bucket === "top3" only — never a positional slice.
export default function MatchResults({ results, meta, onChangeLocation, onReviewCriteria }) {
  const [showMore, setShowMore] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const lastImpressionKey = useRef("");
  const list = Array.isArray(results) ? results : [];
  const top3 = list.filter((result) => result.result_bucket === "top3");
  const confirmed = list.filter((result) => result.result_bucket === "extended_confirmed");
  const directory = list.filter((result) => result.result_bucket === "extended_directory");
  const moreCount = confirmed.length + directory.length;
  const recommendationState = top3.length === 0 && moreCount === 0 ? "empty" : (top3.length < 3 ? "insufficient" : "sufficient");

  useEffect(() => {
    if (list.length === 0 && !meta?.coverage_status) return;
    const impressionKey = list.length > 0
      ? list.map((item) => `${item.id}:${item.result_bucket}:${item.bucket_rank}`).join("|")
      : `empty:${meta?.coverage_status || "unknown"}`;
    if (!impressionKey || impressionKey === lastImpressionKey.current) return;
    lastImpressionKey.current = impressionKey;
    setFeedback(null);
    try {
      base44.analytics.track({
        eventName: "provider_recommendation_results_viewed",
        properties: {
          analytics_version: "patient-search-v1",
          contract_version: meta?.recommendation_contract_version || list[0]?.recommendation_contract_version || "legacy",
          coverage_status: meta?.coverage_status || "unknown",
          recommendation_state: recommendationState,
          need_level: meta?.need_level || "unknown",
          resolved_intent: meta?.resolved_intent || "unknown",
          used_semantic_fallback: meta?.used_semantic_fallback === true,
          result_count: list.length,
          top3_count: top3.length,
          confirmed_count: confirmed.length,
          directory_count: directory.length,
          local_provider_count: Number(meta?.coverage_counts?.local_provider_count) || 0,
          configured_matching_provider_count: Number(meta?.coverage_counts?.configured_matching_provider_count) || 0,
          eligible_provider_count: Number(meta?.coverage_counts?.eligible_provider_count) || 0,
        },
      });
    } catch (_error) {
      // Recommendation display must not depend on analytics.
    }
  }, [confirmed.length, directory.length, list, meta, recommendationState, top3.length]);

  const submitFeedback = (useful) => {
    if (feedback !== null) return;
    setFeedback(useful);
    try {
      base44.analytics.track({
        eventName: "provider_recommendation_feedback_submitted",
        properties: {
          analytics_version: "patient-search-v1",
          contract_version: meta?.recommendation_contract_version || list[0]?.recommendation_contract_version || "legacy",
          coverage_status: meta?.coverage_status || "unknown",
          resolved_intent: meta?.resolved_intent || "unknown",
          result_count: list.length,
          useful,
        },
      });
    } catch (_error) {
      // Feedback UI remains usable if analytics is unavailable.
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
          coverage_status: meta?.coverage_status || "unknown",
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

  if (top3.length === 0 && moreCount === 0) {
    return (
      <NoResultsFlow
        mode="empty"
        meta={meta}
        top3Count={0}
        directoryCount={0}
        onChangeLocation={() => runRecoveryAction("change_location", onChangeLocation)}
        onReviewCriteria={() => runRecoveryAction("review_criteria", onReviewCriteria)}
      />
    );
  }

  const expanded = showMore || top3.length === 0;

  return (
    <div>
      {top3.length > 0 && (
        <>
          <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Cele mai potrivite opțiuni</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Selectate pe baza serviciilor confirmate, relevanței căutării și verificării profilului în localitatea aleasă.
          </p>
          <RoutingNotice meta={meta} />
          <div className="mt-5 space-y-3">
            {top3.map((location) => <MatchResultCard key={location.id} location={location} />)}
          </div>
        </>
      )}

      {top3.length < 3 && (
        <div className={top3.length > 0 ? "mt-6" : ""}>
          <NoResultsFlow
            mode="insufficient"
            meta={meta}
            top3Count={top3.length}
            directoryCount={directory.length}
            onChangeLocation={() => runRecoveryAction("change_location", onChangeLocation)}
            onReviewCriteria={() => runRecoveryAction("review_criteria", onReviewCriteria)}
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
          <div className="mt-3 space-y-3">
            {confirmed.map((location) => <MatchResultCard key={location.id} location={location} />)}
          </div>
        </div>
      )}

      {expanded && directory.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Opțiuni din director</div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aceste profiluri provin din surse publice. VIASEE nu a confirmat toate informațiile afișate.
          </p>
          <div className="mt-3 space-y-3">
            {directory.map((location) => <MatchResultCard key={location.id} location={location} />)}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground/80">
        Ordinea reflectă serviciile confirmate, relevanța căutării și verificarea profilului. VIASEE nu oferă diagnostic medical.
      </p>

      <PatientRequestSubmission results={list} meta={meta} />

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
