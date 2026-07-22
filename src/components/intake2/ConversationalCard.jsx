import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  PATIENT_INTERPRETATION_TIMEOUT_MS,
  PATIENT_MATCHING_TIMEOUT_MS,
  interpretPatientNeedForConfirmation,
  interpretPatientNeedInShadow,
  matchProvidersWithSemanticFallback,
} from "@/lib/providerSemanticSearch";
import { createPatientOperationGuard, isPatientOperationTimeout } from "@/lib/patientOperationControl";
import {
  clearPatientIntakeSession,
  createPatientIntakeEntrySignature,
  createPatientIntakeSnapshot,
  patientIntakeStateFromSnapshot,
  readPatientIntakeSession,
  writePatientIntakeSession,
} from "@/lib/patientIntakeSession";
import { abandonAllPatientRequestIdempotency } from "@/lib/patientRequestIdempotency";
import { buildIntentConfirmationProposal } from "@/lib/patientIntentConfirmation";
import { buildPatientRequestDraft } from "@/lib/patientRequestDraft";
import { INTENTS, CATEGORY_QUESTION, detectIntentFromText, detectSubIntentPrefill, isQuestionApplicable } from "@/lib/intentRegistry";
import { GUIDANCE_KEY_TO_LEGACY_QUESTION_KEY, LEGACY_QUESTION_KEY_TO_GUIDANCE_KEY, toGuidanceAnswers } from "@/lib/patientGuidanceQuestionKeyMap";
import { fetchAdaptiveNextQuestionKey } from "@/lib/patientGuidanceAdaptiveQuestion";
import { buildPatientSafetyAssessment } from "@/lib/patientSafety";
import QuestionChoice from "./QuestionChoice";
import QuestionText from "./QuestionText";
import QuestionLocation from "./QuestionLocation";
import MatchResults from "./MatchResults";
import SearchingTransition from "./SearchingTransition";
import PatientIntentConfirmation from "./PatientIntentConfirmation";
import PatientRequestReview from "./PatientRequestReview";
import UrgencyInterruption from "./UrgencyInterruption";

function resolveOptionServiceKeys(currentKeys = [], option = {}) {
  const optionKeys = Array.isArray(option.service_keys) ? option.service_keys.filter(Boolean) : [];
  if (option.replace_service_keys === true) return [...new Set(optionKeys)];
  return [...new Set([...currentKeys, ...optionKeys])];
}

// Appends the approved guidance-catalog key for a legacy question to the controlled
// question history. Never appends anything for questions with no catalog mapping
// (e.g. "categorie", which is not part of patient-guidance-question-selection-v1).
function appendQuestionHistory(history, legacyKey) {
  const guidanceKey = LEGACY_QUESTION_KEY_TO_GUIDANCE_KEY[legacyKey];
  if (!guidanceKey) return history;
  return history.includes(guidanceKey) ? history : [...history, guidanceKey].slice(-30);
}

const initState = (initialIntent, initialMessage) => {
  const intent = (initialIntent && INTENTS[initialIntent])
    ? initialIntent
    : detectIntentFromText(initialMessage);

  const answers = [];
  let questionHistory = [];
  const explicitServiceKeys = [];
  let serviceKeys = intent ? [...INTENTS[intent].service_keys] : [];

  if (intent) {
    const prefill = detectSubIntentPrefill(intent, initialMessage);
    if (prefill) {
      const question = INTENTS[intent].questions.find((q) => q.key === prefill.question_key);
      const option = question?.options?.find((o) => o.key === prefill.option_key);
      if (option) {
        answers.push({ question_key: prefill.question_key, answer_value: option.key });
        questionHistory = appendQuestionHistory(questionHistory, prefill.question_key);
        if (option.service_keys) {
          serviceKeys = resolveOptionServiceKeys(serviceKeys, option);
          explicitServiceKeys.push(...option.service_keys);
        }
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
    questionHistory,
    explicitServiceKeys: [...new Set(explicitServiceKeys)],
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

// Local, synchronous, deterministic safety check. Runs on every render, needs no
// network call and no backend, and does not depend on state.intent being set.
// This is the primary safety gate — the question_only backend check (if reachable)
// is only a second layer on top of this, never a replacement for it.
function computeLocalSafetyAssessmentFromText(text) {
  if (!text) return null;
  const assessment = buildPatientSafetyAssessment({ text });
  return assessment.blocking ? assessment : null;
}

function computeLocalSafetyAssessment(initialMessage, answers) {
  return computeLocalSafetyAssessmentFromText(patientLanguageText(initialMessage, answers));
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
  const entrySignatureRef = useRef("");
  if (!entrySignatureRef.current) {
    entrySignatureRef.current = createPatientIntakeEntrySignature({
      initialMessage,
      initialIntent,
      search: typeof window !== "undefined" ? window.location.search : "",
    });
  }
  const restoredSessionRef = useRef(undefined);
  if (restoredSessionRef.current === undefined) {
    restoredSessionRef.current = readPatientIntakeSession({
      entrySignature: entrySignatureRef.current,
    });
  }
  const restoredSession = restoredSessionRef.current;
  const shouldInterpretInitialMessage = Boolean(String(initialMessage || "").trim() && !initialIntent);
  const initialAnswersForSafetyCheck = restoredSession
    ? patientIntakeStateFromSnapshot(restoredSession).answers
    : [];
  // A blocking local safety result must win from the very first render — it must never
  // show the AI interpretation spinner or the category question, even for one frame.
  const initialLocalSafetyAssessment = computeLocalSafetyAssessment(initialMessage, initialAnswersForSafetyCheck);
  const initialPhase = initialLocalSafetyAssessment
    ? "questions"
    : (restoredSession?.phase || (shouldInterpretInitialMessage ? "interpreting" : "questions"));
  const [state, setState] = useState(() => (
    restoredSession ? patientIntakeStateFromSnapshot(restoredSession) : initState(initialIntent, initialMessage)
  ));
  const [history, setHistory] = useState(() => restoredSession?.history || []);
  const [phase, setPhase] = useState(initialPhase);
  const [results, setResults] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null);
  const [intentProposal, setIntentProposal] = useState(null);
  const [requestDraft, setRequestDraft] = useState(() => restoredSession?.requestDraft || null);
  const [matchError, setMatchError] = useState(null);
  const [adaptiveLegacyKey, setAdaptiveLegacyKey] = useState(null);
  const [adaptiveSafetyAssessment, setAdaptiveSafetyAssessment] = useState(initialLocalSafetyAssessment);
  const interpretationAttemptedRef = useRef(false);
  const interpretationRequestRef = useRef(createPatientOperationGuard());
  const matchingRequestRef = useRef(createPatientOperationGuard());
  const adaptiveRequestRef = useRef(createPatientOperationGuard());
  const analyticsSessionRef = useRef({
    started: false,
    completed: false,
    phase: initialPhase,
    intent: null,
    answeredCount: 0,
  });

  // Stable text derived every render (cheap string ops), but the assessment object
  // itself is memoized on that text so its reference does not change across renders
  // unless the underlying text actually changes. This prevents the safety useEffect
  // below (which depends on localSafetyAssessment) from re-firing every render and
  // causing a render -> effect -> setState -> render loop for urgent messages.
  const localSafetyText = patientLanguageText(initialMessage, state.answers);
  const localSafetyAssessment = useMemo(
    () => computeLocalSafetyAssessmentFromText(localSafetyText),
    [localSafetyText],
  );

  const intentDef = state.intent ? INTENTS[state.intent] : null;
  const answeredKeys = state.answers.map((a) => a.question_key);
  const questions = (intentDef ? intentDef.questions : [CATEGORY_QUESTION])
    .filter((q) => isQuestionApplicable(q, state.answers));
  const legacyCurrent = questions.find((q) => !answeredKeys.includes(q.key));
  const adaptiveQuestion = adaptiveLegacyKey
    ? questions.find((q) => q.key === adaptiveLegacyKey && !answeredKeys.includes(q.key))
    : null;
  const current = adaptiveQuestion || legacyCurrent;
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
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    adaptiveRequestRef.current.invalidate();
    markSearchStarted(state.intent || option.key);
    pushHistory();
    if (!state.intent) {
      clearPatientIntakeSession();
      abandonAllPatientRequestIdempotency();
      setState((s) => ({
        ...s,
        intent: option.key,
        serviceKeys: [...INTENTS[option.key].service_keys],
        answers: [...s.answers, { question_key: "categorie", answer_value: option.key }],
      }));
      return;
    }
    setState((s) => {
      const next = {
        ...s,
        answers: [...s.answers, { question_key: question.key, answer_value: option.key }],
        questionHistory: appendQuestionHistory(s.questionHistory, question.key),
      };
      if (option.service_keys) {
        next.serviceKeys = resolveOptionServiceKeys(next.serviceKeys, option);
        next.explicitServiceKeys = [...new Set([...s.explicitServiceKeys, ...option.service_keys])];
      }
      if (option.next_intent && INTENTS[option.next_intent]) {
        next.intent = option.next_intent;
        next.serviceKeys = [...INTENTS[option.next_intent].service_keys];
      }
      return next;
    });
  };

  const handleText = (question, value) => {
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    adaptiveRequestRef.current.invalidate();
    markSearchStarted(state.intent);
    trackPatientSearchEvent("patient_search_free_text_submitted", {
      intent: state.intent || "unknown",
      question_key: question.key,
      text_length_band: textLengthBand(value),
    });
    pushHistory();
    setState((s) => ({
      ...s,
      answers: [...s.answers, { question_key: question.key, answer_value: value }],
      questionHistory: appendQuestionHistory(s.questionHistory, question.key),
    }));
  };

  const handleLocation = ({ city, locality, clientAddressText }) => {
    matchingRequestRef.current.invalidate();
    adaptiveRequestRef.current.invalidate();
    markSearchStarted(state.intent);
    pushHistory();
    setState((s) => ({
      ...s,
      scope: "locality",
      city: city || "",
      locality: locality || null,
      clientAddressText: clientAddressText || "",
      answers: [...s.answers, { question_key: "locatie", answer_value: city }],
      questionHistory: appendQuestionHistory(s.questionHistory, "locatie"),
    }));
  };

  const handleCorrectAdaptiveSafety = () => {
    // A safety interruption can never be dismissed to continue with the same urgent
    // text — there is no acknowledgement bypass. This performs a full, hard reset:
    // invalidates in-flight requests, clears the saved intake session, and reloads
    // the wizard on a clean URL (no q/categorie params), so initialMessage cannot
    // carry the same urgent text forward. The user must reformulate or start over.
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    adaptiveRequestRef.current.invalidate();
    clearPatientIntakeSession();
    abandonAllPatientRequestIdempotency();
    window.location.href = "/cerere";
  };

  const handleConfirmInterpretation = () => {
    interpretationRequestRef.current.invalidate();
    if (!intentProposal?.intent || !INTENTS[intentProposal.intent]) return;
    const confirmedState = initState(intentProposal.intent, initialMessage);
    setState(confirmedState);
    setHistory([]);
    setRequestDraft(null);
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
    clearPatientIntakeSession();
    abandonAllPatientRequestIdempotency();
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    adaptiveRequestRef.current.invalidate();
    setAdaptiveSafetyAssessment(null);
    setState(initState(null, ""));
    setHistory([]);
    setRequestDraft(null);
    markSearchStarted(intentProposal?.intent || state.intent);
    trackPatientSearchEvent("patient_search_ai_intent_corrected", {
      proposed_intent: intentProposal?.intent || "unknown",
      confidence_band: intentProposal?.confidence_band || "low",
      agreement_status: intentProposal?.agreement_status || "unknown",
    });
    setIntentProposal(null);
    setPhase("questions");
  };

  const goBack = () => {
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    adaptiveRequestRef.current.invalidate();
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

  const handleReviewConfirm = () => {
    if (!requestDraft) return;
    matchingRequestRef.current.invalidate();
    setMatchError(null);
    trackPatientSearchEvent("patient_search_request_review_confirmed", {
      intent: requestDraft.intent,
      questionnaire_version: requestDraft.questionnaire_version,
      questionnaire_key: requestDraft.questionnaire_key,
      answer_count: requestDraft.answers.length,
      service_key_count: requestDraft.service_keys.length,
    });
    setPhase("submitting");
  };

  const handleReviewEdit = () => {
    matchingRequestRef.current.invalidate();
    setMatchError(null);
    const prev = history[history.length - 1];
    trackPatientSearchEvent("patient_search_request_review_edited", {
      intent: requestDraft?.intent || state.intent || "unknown",
      questionnaire_version: requestDraft?.questionnaire_version || "unknown",
    });
    setRequestDraft(null);
    if (prev) {
      setHistory((items) => items.slice(0, -1));
      setState(prev);
    }
    setPhase("questions");
  };

  const handleRequestCreated = () => {
    clearPatientIntakeSession();
  };

  const retrySearch = () => {
    trackPatientSearchEvent("patient_search_retry_clicked", {
      intent: state.intent || "unknown",
      failure_kind: matchError?.kind || "unknown",
    });
    matchingRequestRef.current.invalidate();
    setMatchError(null);
    setPhase(requestDraft ? "submitting" : "questions");
  };

  useEffect(() => {
    interpretationRequestRef.current.activate();
    matchingRequestRef.current.activate();
    adaptiveRequestRef.current.activate();
    return () => {
      interpretationAttemptedRef.current = false;
      interpretationRequestRef.current.dispose();
      matchingRequestRef.current.dispose();
      adaptiveRequestRef.current.dispose();
      const session = analyticsSessionRef.current;
      if (!session.started || session.completed) return;
      trackPatientSearchEvent("patient_search_abandoned", {
        intent: session.intent || "unknown",
        last_phase: session.phase,
        answered_count: session.answeredCount,
      });
    };
  }, []);

  useEffect(() => {
    const snapshot = createPatientIntakeSnapshot({
      entrySignature: entrySignatureRef.current,
      initialMessage,
      initialIntent,
      state,
      history,
      phase,
      requestDraft,
    });
    writePatientIntakeSession(snapshot);
  }, [history, initialIntent, initialMessage, phase, requestDraft, state]);

  // Local safety must win over everything, regardless of phase/intent, and it never
  // waits for a render cycle: it forces phase to "questions" (so the interruption is
  // shown), blocks the AI interpretation effect from ever firing, and invalidates any
  // in-flight interpretation/matching/adaptive requests. This never calls the backend.
  useEffect(() => {
    if (!localSafetyAssessment) return;
    interpretationAttemptedRef.current = true;
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    adaptiveRequestRef.current.invalidate();
    setAdaptiveLegacyKey(null);
    setAdaptiveSafetyAssessment(localSafetyAssessment);
    setPhase((p) => (p === "questions" ? p : "questions"));
  }, [localSafetyAssessment]);

  // Selectia adaptiva a urmatoarei intrebari: apeleaza modul controlat "question_only".
  // Poate influenta EXCLUSIV care intrebare deja aprobata este afisata acum; nu schimba
  // niciodata matchingul, serviciile confirmate sau ordinea rezultatelor. La orice esec,
  // timeout sau raspuns invalid, ramane pe ordinea legacy (adaptiveLegacyKey=null).
  // The local safety check (above) always runs first and is never overridden by the
  // backend: if it is blocking, question_only is never called at all.
  useEffect(() => {
    if (localSafetyAssessment) {
      setAdaptiveLegacyKey(null);
      return;
    }
    if (phase !== "questions" || !state.intent) {
      setAdaptiveLegacyKey(null);
      return;
    }
    const answeredKeysNow = state.answers.map((a) => a.question_key);
    const legacyCurrentNow = questions.find((q) => !answeredKeysNow.includes(q.key));
    if (!legacyCurrentNow) {
      setAdaptiveLegacyKey(null);
      return;
    }
    const requestId = adaptiveRequestRef.current.begin();
    const guidanceAnswers = toGuidanceAnswers({
      answers: state.answers,
      locality: state.locality,
      city: state.city,
    });
    fetchAdaptiveNextQuestionKey({
      searchText: initialMessage,
      explicitPrimaryIntent: state.intent,
      answers: guidanceAnswers,
      questionHistory: state.questionHistory,
    }, { requestId }).then((result) => {
      if (!adaptiveRequestRef.current.isCurrent(requestId)) return;
      if (result.status === "safety_interruption") {
        setAdaptiveLegacyKey(null);
        setAdaptiveSafetyAssessment(buildPatientSafetyAssessment({ text: initialMessage }));
        return;
      }
      setAdaptiveSafetyAssessment(null);
      if (result.status !== "ok" || !result.nextQuestionKey) {
        setAdaptiveLegacyKey(null);
        return;
      }
      const legacyKey = GUIDANCE_KEY_TO_LEGACY_QUESTION_KEY[result.nextQuestionKey];
      const stillValid = Boolean(legacyKey)
        && questions.some((q) => q.key === legacyKey)
        && !answeredKeysNow.includes(legacyKey);
      setAdaptiveLegacyKey(stillValid ? legacyKey : null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, state.intent, state.answers.length, state.city, state.locality, localSafetyAssessment]);

  useEffect(() => {
    if (localSafetyAssessment) return;
    if (phase !== "interpreting" || interpretationAttemptedRef.current) return;
    interpretationAttemptedRef.current = true;
    const requestId = interpretationRequestRef.current.begin();

    (async () => {
      const interpretationResponse = await interpretPatientNeedForConfirmation({
        search_text: initialMessage,
        deterministic_intent: state.intent || "unknown",
        service_keys: state.serviceKeys,
        answers: [],
      }, {
        timeoutMs: PATIENT_INTERPRETATION_TIMEOUT_MS,
        requestId,
      });
      if (!interpretationRequestRef.current.isCurrent(requestId)) return;

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
    })().catch(() => {
      if (!interpretationRequestRef.current.isCurrent(requestId)) return;
      setPhase("questions");
    });
  }, [phase, initialMessage, state.intent, state.serviceKeys, localSafetyAssessment]);

  useEffect(() => {
    if (phase !== "questions" || !state.intent || current || adaptiveSafetyAssessment || localSafetyAssessment) return;
    const draft = buildPatientRequestDraft({
      state,
      originalMessage: initialMessage,
      interpretation: intentProposal,
    });
    setRequestDraft(draft);
    trackPatientSearchEvent("patient_search_request_review_opened", {
      intent: draft.intent,
      questionnaire_version: draft.questionnaire_version,
      questionnaire_key: draft.questionnaire_key,
      answer_count: draft.answers.length,
      service_key_count: draft.service_keys.length,
    });
    setPhase("review");
  }, [phase, state, current, initialMessage, intentProposal, adaptiveSafetyAssessment, localSafetyAssessment]);

  useEffect(() => {
    if (phase !== "submitting" || !requestDraft) return;
    const requestId = matchingRequestRef.current.begin();
    setMatchError(null);

    (async () => {
      try {
        const languageText = patientLanguageText(initialMessage, state.answers);
        const matchPayload = {
          search_text: languageText,
          intent: requestDraft.intent,
          service_keys: requestDraft.service_keys,
          locality_siruta_code: requestDraft.locality_siruta_code,
          client_address_text: requestDraft.client_address_text,
          for_whom: requestDraft.for_whom,
          age_group: requestDraft.age_group,
          timing_key: requestDraft.timing_key,
          limit: 20,
        };
        void interpretPatientNeedInShadow({
          ...matchPayload,
          deterministic_intent: requestDraft.intent,
          answers: requestDraft.answers
            .filter((answer) => answer.question_key !== "locatie")
            .map((answer) => ({
              question_key: answer.question_key,
              answer_value: answer.answer_value,
            })),
        }, {
          timeoutMs: PATIENT_INTERPRETATION_TIMEOUT_MS,
          requestId: `shadow:${requestId}`,
          completedInterpretation: intentProposal,
        });
        const res = await matchProvidersWithSemanticFallback(matchPayload, {
          timeoutMs: PATIENT_MATCHING_TIMEOUT_MS,
          requestId,
        });
        if (!matchingRequestRef.current.isCurrent(requestId)) return;

        setResults(res.data.results || []);
        setMatchMeta({
          recommendation_contract_version: res.data.recommendation_contract_version || "legacy",
          routing_mode: res.data.routing_mode || null,
          coverage_status: res.data.coverage_status || null,
          coverage_counts: res.data.coverage_counts || null,
          need_level: res.data.need_level || null,
          resolved_intent: res.data.resolved_intent || requestDraft.intent || null,
          used_semantic_fallback: res.usedSemanticFallback === true,
          client_location_source: res.data.client_location_source || null,
          client_address_text: res.data.client_address_text || requestDraft.client_address_text || "",
          patient_request_contract_version: requestDraft.contract_version,
          questionnaire_version: requestDraft.questionnaire_version,
          questionnaire_key: requestDraft.questionnaire_key,
        });
        analyticsSessionRef.current.completed = true;
        trackPatientSearchEvent("patient_search_completed", {
          contract_version: res.data.recommendation_contract_version || "legacy",
          patient_request_contract_version: requestDraft.contract_version,
          questionnaire_version: requestDraft.questionnaire_version,
          intent: res.data.resolved_intent || requestDraft.intent || "unknown",
          coverage_status: res.data.coverage_status || "unknown",
          result_count: res.data.results?.length || 0,
          service_key_count: requestDraft.service_keys.length,
          used_semantic_fallback: res.usedSemanticFallback === true,
        });
        setPhase("results");
      } catch (error) {
        if (!matchingRequestRef.current.isCurrent(requestId)) return;
        const timedOut = isPatientOperationTimeout(error);
        trackPatientSearchEvent("patient_search_failed", {
          intent: requestDraft.intent || state.intent || "unknown",
          stage: "provider_matching",
          failure_kind: timedOut ? "timeout" : "technical",
        });
        setMatchError({
          kind: timedOut ? "timeout" : "technical",
          message: timedOut
            ? "Căutarea a durat prea mult. Cererea ta a fost păstrată."
            : "A apărut o eroare tehnică. Cererea ta a fost păstrată.",
        });
        setPhase("error");
      }
    })();
  }, [phase, requestDraft, initialMessage, state.answers, state.intent]);


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

      {phase === "questions" && adaptiveSafetyAssessment && (
        <div className="py-2">
          <UrgencyInterruption
            assessment={adaptiveSafetyAssessment}
            mode="blocking"
            onCorrect={handleCorrectAdaptiveSafety}
          />
        </div>
      )}

      {phase === "questions" && !adaptiveSafetyAssessment && current && (
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

      {phase === "review" && requestDraft && (
        <PatientRequestReview
          draft={requestDraft}
          onConfirm={handleReviewConfirm}
          onEdit={handleReviewEdit}
        />
      )}

      {phase === "submitting" && <SearchingTransition />}

      {phase === "results" && <MatchResults results={results} meta={matchMeta} onRequestCreated={handleRequestCreated} />}

      {phase === "error" && (
        <div className="py-6">
          <p role="alert" className="text-sm text-muted-foreground">
            {matchError?.message || "A apărut o eroare tehnică. Cererea ta a fost păstrată."}
          </p>
          <button
            type="button"
            onClick={retrySearch}
            className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Reîncearcă
          </button>
        </div>
      )}
    </motion.div>
  );
}