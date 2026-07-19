import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  interpretPatientNeedForConfirmation,
  interpretPatientNeedInShadow,
  matchProvidersWithSemanticFallback,
} from "@/lib/providerSemanticSearch";
import { buildIntentConfirmationProposal } from "@/lib/patientIntentConfirmation";
import { INTENTS, CATEGORY_QUESTION, detectIntentFromText, detectSubIntentPrefill } from "@/lib/intentRegistry";
import QuestionChoice from "./QuestionChoice";
import QuestionText from "./QuestionText";
import QuestionLocation from "./QuestionLocation";
import MatchResults from "./MatchResults";
import SearchingTransition from "./SearchingTransition";
import PatientIntentConfirmation from "./PatientIntentConfirmation";

function resolveOptionServiceKeys(currentKeys = [], option = {}) {
  const optionKeys = Array.isArray(option.service_keys) ? option.service_keys.filter(Boolean) : [];
  if (option.replace_service_keys === true) return [...new Set(optionKeys)];
  return [...new Set([...currentKeys, ...optionKeys])];
}

const initState = (initialIntent, initialMessage) => {
  const intent = (initialIntent && INTENTS[initialIntent])
    ? initialIntent
    : detectIntentFromText(initialMessage);

  const answers = [];
  let serviceKeys = intent ? [...INTENTS[intent].service_keys] : [];

  if (intent) {
    const prefill = detectSubIntentPrefill(intent, initialMessage);
    if (prefill) {
      const question = INTENTS[intent].questions.find((q) => q.key === prefill.question_key);
      const option = question?.options?.find((o) => o.key === prefill.option_key);
      if (option) {
        answers.push({ question_key: prefill.question_key, answer_value: option.key });
        if (option.service_keys) serviceKeys = resolveOptionServiceKeys(serviceKeys, option);
      }
    }
  }

  return {
    intent,
    answers,
    serviceKeys,
    city: "",
    scope: "",
    locality: null,
    clientAddressText: "",
  };
};

function patientLanguageText(initialMessage, answers) {
  const values = [
    initialMessage,
    ...(answers || [])
      .filter((answer) => answer.question_key === "descriere")
      .map((answer) => answer.answer_value),
  ];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].join(". ");
}

const PATIENT_SEARCH_ANALYTICS_VERSION = "patient-search-v1";

function textLengthBand(value) {
  const length = String(value || "").trim().length;
  if (length === 0) return "empty";
  if (length <= 40) return "short";
  if (length <= 120) return "medium";
  return "long";
}

function trackPatientSearchEvent(eventName, properties = {}) {
  try {
    base44.analytics.track({
      eventName,
      properties: {
        analytics_version: PATIENT_SEARCH_ANALYTICS_VERSION,
        ...properties,
      },
    });
  } catch (_error) {
    // Patient search must never depend on analytics.
  }
}

export default function ConversationalCard({ initialMessage = "", initialIntent = null }) {
  const reduceMotion = useReducedMotion();
  const shouldInterpretInitialMessage = Boolean(String(initialMessage || "").trim() && !initialIntent);
  const [state, setState] = useState(() => initState(initialIntent, initialMessage));
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState(() => (shouldInterpretInitialMessage ? "interpreting" : "questions"));
  const [results, setResults] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null);
  const [intentProposal, setIntentProposal] = useState(null);
  const interpretationAttemptedRef = useRef(false);
  const analyticsSessionRef = useRef({
    started: false,
    completed: false,
    phase: shouldInterpretInitialMessage ? "interpreting" : "questions",
    intent: null,
    answeredCount: 0,
  });

  const intentDef = state.intent ? INTENTS[state.intent] : null;
  const questions = intentDef ? intentDef.questions : [CATEGORY_QUESTION];
  const answeredKeys = state.answers.map((a) => a.question_key);
  const current = questions.find((q) => !answeredKeys.includes(q.key));
  const total = state.answers.length + questions.filter((q) => !answeredKeys.includes(q.key)).length;
  const progress = total > 0 ? Math.round((state.answers.length / total) * 100) : 0;

  analyticsSessionRef.current.phase = phase;
  analyticsSessionRef.current.intent = state.intent || null;
  analyticsSessionRef.current.answeredCount = state.answers.length;

  const markSearchStarted = (intent) => {
    if (analyticsSessionRef.current.started) return;
    analyticsSessionRef.current.started = true;
    trackPatientSearchEvent("patient_search_started", {
      intent: intent || "unknown",
      entry_mode: initialMessage ? "free_text" : "guided",
      initial_text_length_band: textLengthBand(initialMessage),
    });
  };

  const pushHistory = () => setHistory((h) => [...h, state]);

  const handleChoice = (question, option) => {
    markSearchStarted(state.intent || option.key);
    pushHistory();
    if (!state.intent) {
      setState((s) => ({
        ...s,
        intent: option.key,
        serviceKeys: [...INTENTS[option.key].service_keys],
        answers: [...s.answers, { question_key: "categorie", answer_value: option.key }],
      }));
      return;
    }
    setState((s) => {
      const next = { ...s, answers: [...s.answers, { question_key: question.key, answer_value: option.key }] };
      if (option.service_keys) next.serviceKeys = resolveOptionServiceKeys(next.serviceKeys, option);
      if (option.next_intent && INTENTS[option.next_intent]) {
        next.intent = option.next_intent;
        next.serviceKeys = [...INTENTS[option.next_intent].service_keys];
      }
      return next;
    });
  };

  const handleText = (question, value) => {
    markSearchStarted(state.intent);
    trackPatientSearchEvent("patient_search_free_text_submitted", {
      intent: state.intent || "unknown",
      question_key: question.key,
      text_length_band: textLengthBand(value),
    });
    pushHistory();
    setState((s) => ({ ...s, answers: [...s.answers, { question_key: question.key, answer_value: value }] }));
  };

  const handleLocation = ({ city, locality, clientAddressText }) => {
    markSearchStarted(state.intent);
    pushHistory();
    setState((s) => ({
      ...s,
      scope: "locality",
      city: city || "",
      locality: locality || null,
      clientAddressText: clientAddressText || "",
      answers: [...s.answers, { question_key: "locatie", answer_value: city }],
    }));
  };

  const handleConfirmInterpretation = () => {
    if (!intentProposal?.intent || !INTENTS[intentProposal.intent]) return;
    const confirmedState = initState(intentProposal.intent, initialMessage);
    setState(confirmedState);
    setHistory([]);
    markSearchStarted(intentProposal.intent);
    trackPatientSearchEvent("patient_search_ai_intent_confirmed", {
      intent: intentProposal.intent,
      confidence_band: intentProposal.confidence_band,
      agreement_status: intentProposal.agreement_status,
      interpretation_version: intentProposal.version || "unknown",
      safety_flag_count: intentProposal.possible_safety_flags?.length || 0,
    });
    setPhase("questions");
  };

  const handleCorrectInterpretation = () => {
    setState(initState(null, ""));
    setHistory([]);
    markSearchStarted(intentProposal?.intent || state.intent);
    trackPatientSearchEvent("patient_search_ai_intent_corrected", {
      proposed_intent: intentProposal?.intent || "unknown",
      confidence_band: intentProposal?.confidence_band || "low",
      agreement_status: intentProposal?.agreement_status || "unknown",
    });
    setPhase("questions");
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    trackPatientSearchEvent("patient_search_reformulation_started", {
      intent: state.intent || "unknown",
      question_key: current?.key || "unknown",
      answered_count: state.answers.length,
    });
    setHistory((h) => h.slice(0, -1));
    setState(prev);
  };

  const retrySearch = () => {
    trackPatientSearchEvent("patient_search_retry_clicked", {
      intent: state.intent || "unknown",
    });
    setPhase("questions");
  };

  useEffect(() => () => {
    const session = analyticsSessionRef.current;
    if (!session.started || session.completed) return;
    trackPatientSearchEvent("patient_search_abandoned", {
      intent: session.intent || "unknown",
      last_phase: session.phase,
      answered_count: session.answeredCount,
    });
  }, []);

  useEffect(() => {
    if (phase !== "interpreting" || interpretationAttemptedRef.current) return;
    interpretationAttemptedRef.current = true;

    (async () => {
      const interpretationResponse = await interpretPatientNeedForConfirmation({
        search_text: initialMessage,
        deterministic_intent: state.intent || "unknown",
        service_keys: state.serviceKeys,
        answers: [],
      });
      const proposal = buildIntentConfirmationProposal(interpretationResponse, {
        allowedIntents: Object.keys(INTENTS),
        deterministicIntent: state.intent,
      });

      trackPatientSearchEvent("patient_search_ai_interpretation_resolved", {
        outcome: proposal.status,
        proposed_intent: proposal.intent || "unknown",
        confidence_band: proposal.confidence_band,
        agreement_status: proposal.agreement_status,
        safety_flag_count: proposal.possible_safety_flags?.length || 0,
      });

      if (proposal.status === "fallback") {
        setPhase("questions");
        return;
      }

      setIntentProposal(proposal);
      setPhase("confirm_intent");
    })();
  }, [phase, initialMessage, state.intent, state.serviceKeys]);

  useEffect(() => {
    if (phase !== "questions" || !state.intent || current) return;
    setPhase("submitting");
    (async () => {
      try {
        const languageText = patientLanguageText(initialMessage, state.answers);
        const matchPayload = {
          search_text: languageText,
          intent: state.intent,
          service_keys: state.serviceKeys,
          locality_siruta_code: state.locality?.siruta_code || "",
          client_address_text: state.clientAddressText || "",
          for_whom: state.answers.find((answer) => answer.question_key === "pentru_cine")?.answer_value || null,
          age_group: state.answers.find((answer) => answer.question_key === "varsta_copil")?.answer_value || null,
          timing_key: state.answers.find((answer) => answer.question_key === "timing")?.answer_value || null,
          limit: 20,
        };
        void interpretPatientNeedInShadow({
          ...matchPayload,
          deterministic_intent: state.intent,
          answers: state.answers.filter((answer) => answer.question_key !== "locatie"),
        });
        const res = await matchProvidersWithSemanticFallback(matchPayload);
        setResults(res.data.results || []);
        setMatchMeta({
          recommendation_contract_version: res.data.recommendation_contract_version || "legacy",
          routing_mode: res.data.routing_mode || null,
          coverage_status: res.data.coverage_status || null,
          coverage_counts: res.data.coverage_counts || null,
          need_level: res.data.need_level || null,
          resolved_intent: res.data.resolved_intent || state.intent || null,
          used_semantic_fallback: res.usedSemanticFallback === true,
          client_location_source: res.data.client_location_source || null,
          client_address_text: res.data.client_address_text || state.clientAddressText || "",
        });
        analyticsSessionRef.current.completed = true;
        trackPatientSearchEvent("patient_search_completed", {
          contract_version: res.data.recommendation_contract_version || "legacy",
          intent: res.data.resolved_intent || state.intent || "unknown",
          coverage_status: res.data.coverage_status || "unknown",
          result_count: res.data.results?.length || 0,
          service_key_count: state.serviceKeys.length,
          used_semantic_fallback: res.usedSemanticFallback === true,
        });
        setPhase("results");
      } catch (_error) {
        trackPatientSearchEvent("patient_search_failed", {
          intent: state.intent || "unknown",
          stage: "provider_matching",
        });
        setPhase("error");
      }
    })();
  }, [phase, state, current, initialMessage]);

  return (
    <motion.div
      layout
      initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
      className="mx-auto w-full max-w-2xl rounded-[1.5rem] border border-border bg-card p-5 text-left shadow-[0_18px_55px_rgba(20,20,20,0.11)] sm:rounded-[1.75rem] sm:p-10"
    >
      {initialMessage && (
        <p className="mb-6 text-xs text-muted-foreground">
          Ai spus: <span className="italic">&bdquo;{initialMessage}&rdquo;</span>
        </p>
      )}

      {phase === "interpreting" && (
        <div className="py-8 text-center sm:py-12">
          <motion.div
            animate={reduceMotion ? undefined : { rotate: [0, 8, -8, 0] }}
            transition={reduceMotion ? undefined : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Sparkles className="h-5 w-5" />
          </motion.div>
          <h2 className="mt-5 font-heading text-xl font-bold text-foreground sm:text-2xl">
            Intelegem ce cauti
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Interpretam cererea, apoi iti cerem confirmarea inainte de chestionar.
          </p>
        </div>
      )}

      {phase === "confirm_intent" && intentProposal && (
        <PatientIntentConfirmation
          proposal={intentProposal}
          intentLabel={intentProposal.intent ? INTENTS[intentProposal.intent]?.label : ""}
          onConfirm={handleConfirmInterpretation}
          onCorrect={handleCorrectInterpretation}
        />
      )}

      {phase === "questions" && current && (
        <>
          <div className="mb-6 flex items-center gap-4">
            {history.length > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Inapoi
              </button>
            ) : <span />}
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${Math.max(progress, 4)}%` }}
                transition={{ duration: reduceMotion ? 0 : 0.35 }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${state.intent || "categorie"}-${current.key}`}
              initial={reduceMotion ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -14 }}
              transition={{ duration: reduceMotion ? 0 : 0.2 }}
            >
              <h2 className="font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {current.title}
              </h2>
              {current.type === "choice" && <QuestionChoice question={current} onSelect={handleChoice} />}
              {current.type === "text" && <QuestionText question={current} onSubmit={handleText} />}
              {current.type === "location" && <QuestionLocation onAnswer={handleLocation} />}
            </motion.div>
          </AnimatePresence>

          {intentDef?.notice && (
            <p className="mt-7 text-xs leading-relaxed text-muted-foreground">{intentDef.notice}</p>
          )}
        </>
      )}

      {phase === "submitting" && <SearchingTransition />}

      {phase === "results" && <MatchResults results={results} meta={matchMeta} />}

      {phase === "error" && (
        <div className="py-6">
          <p className="text-sm text-muted-foreground">Ceva nu a functionat. Incearca din nou.</p>
          <button
            type="button"
            onClick={retrySearch}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Incearca din nou
          </button>
        </div>
      )}
    </motion.div>
  );
}
