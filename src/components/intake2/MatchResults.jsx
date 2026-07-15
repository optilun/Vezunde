import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import MatchResultCard from "./MatchResultCard";

const EMPTY_RECOMMENDATION_STATES = {
  no_local_providers: {
    title: "Nu avem inca furnizori publicati pentru filtrele alese.",
    description: "VIASEE a cautat corect in localitatea selectata, dar directorul nu contine inca profiluri publicate care sa corespunda filtrelor.",
  },
  local_service_data_missing: {
    title: "Exista furnizori in localitate, dar nu avem suficiente date despre serviciul cautat.",
    description: "Nu putem confirma momentan cine ofera acest serviciu. Asta descrie datele disponibile in VIASEE, nu inseamna ca serviciul nu exista in localitate.",
  },
  no_eligible_local_results: {
    title: "Nu avem momentan un rezultat eligibil pentru aceasta nevoie.",
    description: "Exista furnizori si date locale, dar niciun profil nu indeplineste toate conditiile de serviciu, verificare sau specializare.",
  },
};

const DEFAULT_EMPTY_RECOMMENDATION_STATE = {
  title: "Nu avem inca profiluri relevante in zona ta.",
  description: "VIASEE a cautat strict in localitatea selectata. Poti alege manual alta localitate si incerca din nou.",
};

function RoutingNotice({ meta }) {
  if (!meta?.routing_mode) return null;
  if (meta.routing_mode === "locality") {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Am cautat dupa localitatea selectata: {meta.client_address_text || "localitate selectata"}.
      </div>
    );
  }
  return null;
}

// Module 3E: sections are driven STRICTLY by result_bucket from the backend.
// Top 3 = result_bucket === "top3" only — never a positional slice.
export default function MatchResults({ results, meta }) {
  const [showMore, setShowMore] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const lastImpressionKey = useRef("");
  const list = results || [];
  const top3 = list.filter((r) => r.result_bucket === "top3");
  const confirmed = list.filter((r) => r.result_bucket === "extended_confirmed");
  const directory = list.filter((r) => r.result_bucket === "extended_directory");
  const moreCount = confirmed.length + directory.length;

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
          contract_version: meta?.recommendation_contract_version || list[0]?.recommendation_contract_version || "legacy",
          coverage_status: meta?.coverage_status || "unknown",
          need_level: meta?.need_level || "unknown",
          result_count: list.length,
          top3_count: top3.length,
          confirmed_count: confirmed.length,
          directory_count: directory.length,
        },
      });
    } catch (_error) {
      // Recommendation display must not depend on analytics.
    }
  }, [confirmed.length, directory.length, list, meta, top3.length]);

  const submitFeedback = (useful) => {
    if (feedback !== null) return;
    setFeedback(useful);
    try {
      base44.analytics.track({
        eventName: "provider_recommendation_feedback_submitted",
        properties: {
          contract_version: meta?.recommendation_contract_version || list[0]?.recommendation_contract_version || "legacy",
          coverage_status: meta?.coverage_status || "unknown",
          result_count: list.length,
          useful,
        },
      });
    } catch (_error) {
      // Feedback UI remains usable if analytics is unavailable.
    }
  };

  if (top3.length === 0 && moreCount === 0) {
    const emptyState = EMPTY_RECOMMENDATION_STATES[meta?.coverage_status]
      || DEFAULT_EMPTY_RECOMMENDATION_STATE;
    return (
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">{emptyState.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {emptyState.description}
        </p>
        <RoutingNotice meta={meta} />
        <Link to="/cauta" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
          Exploreaza toti furnizorii
        </Link>
      </div>
    );
  }

  const expanded = showMore || top3.length === 0;

  return (
    <div>
      {top3.length > 0 ? (
        <>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Cele mai potrivite optiuni</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Selectate pe baza serviciilor confirmate, relevantei cautarii si verificarii profilului in localitatea aleasa.
          </p>
          <RoutingNotice meta={meta} />
          <div className="mt-5 space-y-3">
            {top3.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </>
      ) : (
        <>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Nu avem inca optiuni confirmate pentru aceasta nevoie in zona ta</h2>
          {directory.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Poti vedea mai jos cateva profiluri din director.
            </p>
          )}
          <RoutingNotice meta={meta} />
        </>
      )}

      {moreCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="mt-6 w-full rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Vezi mai multe optiuni ({moreCount})
        </button>
      )}

      {expanded && confirmed.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mai multe optiuni relevante</div>
          <div className="mt-3 space-y-3">
            {confirmed.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </div>
      )}

      {expanded && directory.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Optiuni din director</div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aceste profiluri provin din surse publice. VIASEE nu a confirmat toate informatiile afisate.
          </p>
          <div className="mt-3 space-y-3">
            {directory.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground/80">
        Ordinea reflecta serviciile confirmate, relevanta cautarii si verificarea profilului. VIASEE nu ofera diagnostic medical.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {feedback === null ? (
          <>
            <span className="mr-1 text-xs font-medium text-foreground">Ti-au fost utile recomandarile?</span>
            <button
              type="button"
              onClick={() => submitFeedback(true)}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-foreground/40"
            >
              Da
            </button>
            <button
              type="button"
              onClick={() => submitFeedback(false)}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-foreground/40"
            >
              Nu
            </button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Multumim. Feedbackul tau ne ajuta sa imbunatatim recomandarile.</span>
        )}
      </div>
    </div>
  );
}

