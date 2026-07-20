import React, { useState } from "react";
import { ArrowLeft, Expand, MapPin, Search } from "lucide-react";
import { matchProvidersWithSemanticFallback } from "@/lib/providerSemanticSearch";
import {
  buildPatientRequestReformulationSeed,
  createPatientRequestReformulationUrl,
} from "@/lib/patientNoResponseReviewClient";
import { storePatientRequestDraft } from "@/lib/patientRequestPersistenceClient";
import MatchResults from "./MatchResults";
import SearchingTransition from "./SearchingTransition";

function searchText(seed) {
  const draft = seed?.request_draft || {};
  const descriptions = (Array.isArray(draft.answers) ? draft.answers : [])
    .filter((answer) => answer?.question_key === "descriere")
    .map((answer) => String(answer?.answer_value || "").trim())
    .filter(Boolean);
  return [...new Set([seed?.detailed_message, draft.original_message, ...descriptions]
    .map((value) => String(value || "").trim())
    .filter(Boolean))].join(". ");
}

export default function PatientCountyReformulation({ seed }) {
  const [phase, setPhase] = useState("review");
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const draft = {
    ...(seed?.request_draft || {}),
    location_scope: "county",
  };

  const runSearch = async () => {
    setPhase("searching");
    setError("");
    try {
      const response = await matchProvidersWithSemanticFallback({
        search_text: searchText(seed),
        intent: draft.intent,
        service_keys: Array.isArray(draft.service_keys) ? draft.service_keys : [],
        locality_siruta_code: draft.locality_siruta_code,
        client_address_text: draft.client_address_text,
        for_whom: draft.for_whom,
        age_group: draft.age_group,
        timing_key: draft.timing_key,
        query_scope: "county",
        limit: 50,
      });
      const data = response.data || {};
      if (data.query_scope !== "county") throw new Error("Cautarea nu a confirmat aria judetului.");
      storePatientRequestDraft(draft);
      setResults(Array.isArray(data.results) ? data.results : []);
      setMeta({
        recommendation_contract_version: data.recommendation_contract_version || "legacy",
        routing_mode: data.routing_mode || "county",
        query_scope: data.query_scope || "county",
        coverage_status: data.coverage_status || null,
        coverage_counts: data.coverage_counts || null,
        need_level: data.need_level || null,
        resolved_intent: data.resolved_intent || draft.intent || null,
        selected_locality_name: data.selected_locality_name || draft.city || null,
        selected_county_name: data.selected_county_name || draft.county || null,
        selected_county_code: data.selected_county_code || null,
        client_address_text: data.client_address_text || draft.client_address_text || "",
        used_semantic_fallback: response.usedSemanticFallback === true,
      });
      setPhase("results");
    } catch (searchError) {
      setError(searchError?.message || "Cautarea in judet nu a putut fi efectuata.");
      setPhase("error");
    }
  };

  const restartQuestionnaire = () => {
    const nextSeed = buildPatientRequestReformulationSeed({
      mode: "criteria",
      request: {
        public_reference: seed?.source_public_reference,
        intent: draft.intent,
        city: draft.city,
        county: draft.county,
      },
      workspace: {
        detailed_message: seed?.detailed_message,
        request_draft: draft,
      },
    });
    window.location.assign(createPatientRequestReformulationUrl(nextSeed));
  };

  if (phase === "searching") return <SearchingTransition />;
  if (phase === "results") return <MatchResults results={results} meta={meta} />;

  return (
    <section className="mx-auto w-full max-w-2xl rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_18px_55px_rgba(20,20,20,0.11)] sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary">
        <Expand className="h-3.5 w-3.5" /> Cautare noua, extinsa explicit
      </div>
      <h1 className="mt-5 font-heading text-xl font-extrabold text-foreground sm:text-2xl">
        Extinde cautarea in judetul {draft.county || "selectat"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Folosim criteriile cererii anterioare, dar cream o cautare noua. Cererea existenta ramane activa si nu este redistribuita automat.
      </p>

      <div className="mt-5 rounded-2xl border border-border bg-secondary/35 p-4">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-bold text-foreground">Arie propusa</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {draft.city || "Localitatea selectata"} si celelalte localitati din judetul {draft.county || "selectat"}.
            </p>
          </div>
        </div>
        {seed?.detailed_message && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Cererea folosita</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">{seed.detailed_message}</p>
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-xs text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => void runSearch()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground hover:opacity-90">
          <Search className="h-4 w-4" /> Cauta in judet
        </button>
        <button type="button" onClick={restartQuestionnaire} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-bold text-foreground hover:bg-secondary">
          <ArrowLeft className="h-4 w-4" /> Refa chestionarul
        </button>
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        Nicio locatie nu primeste cererea doar prin aceasta cautare. Distribuirea unei cereri noi necesita din nou confirmarea si acordul tau.
      </p>
    </section>
  );
}
