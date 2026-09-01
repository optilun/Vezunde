import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  PATIENT_INTERPRETATION_TIMEOUT_MS,
  PATIENT_MATCHING_TIMEOUT_MS,
  interpretPatientNeedForConfirmation,
  interpretPatientNeedInShadow,
  matchProvidersWithSemanticFallback,
  selectPatientGuidanceNextQuestion,
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
import { buildPatientSafetyAssessment, deterministicSafetyFlagsFromText } from "@/lib/patientSafety";
import { INTENTS, CATEGORY_QUESTION, detectIntentFromText, detectSubIntentPrefill } from "@/lib/intentRegistry";
import {
  PATIENT_GUIDANCE_QUESTION_CATALOG,
  getApprovedPatientGuidanceQuestion,
} from "../../../shared/patientGuidanceQuestionCatalog.js";
import QuestionChoice from "./QuestionChoice";
import QuestionText from "./QuestionText";
import QuestionLocation from "./QuestionLocation";
import SearchingTransition from "./SearchingTransition";
import PatientIntentConfirmation from "./PatientIntentConfirmation";
import PatientRequestReview from "./PatientRequestReview";
import UrgencyInterruption from "./UrgencyInterruption";

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
  let explicitServiceKeys = [];

  if (intent) {
    const prefill = detectSubIntentPrefill(intent, initialMessage);
    if (prefill) {
      const question = INTENTS[intent].questions.find((q) => q.key === prefill.question_key);
      const option = question?.options?.find((o) => o.key === prefill.option_key);
      if (option) {
        answers.push({ question_key: prefill.question_key, answer_value: option.key });
        if (option.service_keys) {
          serviceKeys = resolveOptionServiceKeys(serviceKeys, option);
          explicitServiceKeys = resolveOptionServiceKeys(explicitServiceKeys, option);
        }
      }
    }
  }

  return {
    intent,
    answers,
    questionHistory: answers.map((answer) => answer.question_key),
    serviceKeys,
    explicitServiceKeys,
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
      .filter((answer) => ["descriere", "symptom_description"].includes(answer.question_key))
      .map((answer) => answer.answer_value),
  ];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].join(". ");
}

function expandedAnsweredQuestionKeys(values = []) {
  const keys = new Set((Array.isArray(values) ? values : []).filter(Boolean));
  for (const question of Object.values(PATIENT_GUIDANCE_QUESTION_CATALOG)) {
    const aliases = [question.key, ...(question.legacy_question_keys || [])];
    if (aliases.some((key) => keys.has(key))) {
      for (const key of aliases) keys.add(key);
    }
  }
  return keys;
}

function fallbackQuestionSelection() {
  return { status: "fallback", question: null };
}

function controlledQuestionSelection(response, state) {
  const selection = response?.patient_guidance_question_selection;
  if (response?.status !== "completed" || !selection) return fallbackQuestionSelection();
  if (selection.status === "complete") return { status: "complete", question: null };
  if (selection.status === "safety_blocked") return { status: "blocked", question: null };
  if (selection.status !== "selected" || !selection.next_question_key) {
    return fallbackQuestionSelection();
  }

  const alreadySeen = expandedAnsweredQuestionKeys([
    ...(Array.isArray(state.answers) ? state.answers.map((answer) => answer.question_key) : []),
    ...(Array.isArray(state.questionHistory) ? state.questionHistory : []),
  ]);
  if (alreadySeen.has(selection.next_question_key)) return fallbackQuestionSelection();

  const question = getApprovedPatientGuidanceQuestion(selection.next_question_key);
  return question
    ? { status: "selected", question }
    : fallbackQuestionSelection();
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
  const navigate = useNavigate();
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
  const initialPhase = restoredSession?.phase || (shouldInterpretInitialMessage ? "interpreting" : "questions");
  const [state, setState] = useState(() => (
    restoredSession ? patientIntakeStateFromSnapshot(restoredSession) : initState(initialIntent, initialMessage)
  ));
  const [history, setHistory] = useState(() => restoredSession?.history || []);
  const [phase, setPhase] = useState(initialPhase);
  const [questionPhase, setQuestionPhase] = useState("answer");
  const [results, setResults] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null);
  const [intentProposal, setIntentProposal] = useState(null);
  const [requestDraft, setRequestDraft] = useState(() => restoredSession?.requestDraft || null);
  const [questionSelection, setQuestionSelection] = useState(() => (
    state.intent ? { status: "pending", question: null } : { status: "idle", question: null }
  ));
  const [matchError, setMatchError] = useState(null);
  // 2026-09-01 (audit cautare/recomandare LLM, sectiunea 3.3): verificare deterministica,
  // identica cu cea din Search.jsx, pe MESAJUL LIBER initial al pacientului. Inainte de
  // aceasta corectie, singurul control de siguranta pe acest text era interpretarea LLM
  // (mode "interpret_only") - si cand acel apel pica sau da timeout (fallback normal,
  // planificat in cod), semnalul disparea complet, fara nicio alta plasa. Verificarea de
  // aici nu depinde de LLM si nu poate esua/intarzia, deci ramane activa mereu.
  const [initialSafetyAcknowledged, setInitialSafetyAcknowledged] = useState(false);
  const initialSafetyFlags = useMemo(
    () => deterministicSafetyFlagsFromText(initialMessage),
    [initialMessage],
  );
  const showInitialSafetyBlock = initialSafetyFlags.length > 0 && !initialSafetyAcknowledged;
  const interpretationAttemptedRef = useRef(false);
  const interpretationRequestRef = useRef(createPatientOperationGuard());
  const questionSelectionRequestRef = useRef(createPatientOperationGuard());
  const matchingRequestRef = useRef(createPatientOperationGuard());
  const analyticsSessionRef = useRef({
    started: false,
    completed: false,
    phase: initialPhase,
    intent: null,
    answeredCount: 0,
  });

  const intentDef = state.intent ? INTENTS[state.intent] : null;
  const questions = intentDef ? intentDef.questions : [CATEGORY_QUESTION];
  const answeredKeys = expandedAnsweredQuestionKeys(state.answers.map((answer) => answer.question_key));
  const legacyCurrent = questions.find((question) => !answeredKeys.has(question.key));
  const current = !state.intent
    ? CATEGORY_QUESTION
    : (questionSelection.status === "selected"
      ? questionSelection.question
      : (["fallback", "idle"].includes(questionSelection.status) ? legacyCurrent : null));
  // 2026-09-01: bara numara intrebarile din lista veche chiar si cand traseul e condus de
  // catalogul adaptiv, care nu le va pune niciodata - deci raporta sub adevar si apoi sarea
  // brusc la final. Pe traseul adaptiv nu stim cate intrebari mai urmeaza, asa ca nu ne
  // prefacem: bara avanseaza cu fiecare raspuns, dar se opreste sub 100% pana cand
  // chestionarul chiar s-a incheiat. Mai bine imprecisa si onesta decat precisa si falsa.
  const onAdaptivePath = questionSelection.status === "selected";
  const remainingLegacyQuestionCount = questions.filter((question) => !answeredKeys.has(question.key)).length;
  const total = state.answers.length + (onAdaptivePath ? 1 : remainingLegacyQuestionCount);
  const rawProgress = total > 0 ? Math.round((state.answers.length / total) * 100) : 0;
  const progress = questionSelection.status === "complete"
    ? 100
    : Math.min(rawProgress, onAdaptivePath ? 85 : 100);

  // Motivul blocarii de siguranta, recalculat local din ce a raspuns pacientul si din
  // mesajul lui initial, ca ecranul de urgenta sa nu fie gol. Aceeasi functie ca pe server.
  const blockedSafetyAssessment = useMemo(() => {
    const assessment = buildPatientSafetyAssessment({
      answers: state.answers,
      text: initialMessage,
    });
    return assessment.blocking ? assessment : { ...assessment, blocking: true };
  }, [state.answers, initialMessage]);

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
  const prepareAdaptiveSelection = () => {
    questionSelectionRequestRef.current.invalidate();
    setQuestionSelection({ status: "pending", question: null });
  };

  const handleChoice = (question, option) => {
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    markSearchStarted(state.intent || option.key);
    pushHistory();
    prepareAdaptiveSelection();
    if (!state.intent) {
      clearPatientIntakeSession();
      abandonAllPatientRequestIdempotency();
      setState((s) => ({
        ...s,
        intent: option.key,
        serviceKeys: [...INTENTS[option.key].service_keys],
        explicitServiceKeys: [],
        answers: [...s.answers, { question_key: "categorie", answer_value: option.key }],
        questionHistory: [...new Set([...(s.questionHistory || []), "categorie"])],
      }));
      return;
    }
    setState((s) => {
      const next = {
        ...s,
        answers: [...s.answers, { question_key: question.key, answer_value: option.key }],
        questionHistory: [...new Set([...(s.questionHistory || []), question.key])],
      };
      if (option.service_keys) {
        next.serviceKeys = resolveOptionServiceKeys(next.serviceKeys, option);
        next.explicitServiceKeys = resolveOptionServiceKeys(next.explicitServiceKeys, option);
      }
      if (option.next_intent && INTENTS[option.next_intent]) {
        next.intent = option.next_intent;
        next.serviceKeys = [...INTENTS[option.next_intent].service_keys];
        next.explicitServiceKeys = [];
      }
      if (question.key === "routine_vs_symptom" && option.key === "symptom") {
        next.intent = "simptome_oftalmologice";
        next.serviceKeys = [...INTENTS.simptome_oftalmologice.service_keys];
        next.explicitServiceKeys = [];
      }
      if (question.key === "routine_vs_symptom" && option.key === "routine") {
        next.intent = "control_vedere";
        next.serviceKeys = [...INTENTS.control_vedere.service_keys];
        next.explicitServiceKeys = [];
      }
      if (question.key === "for_whom" && option.key === "child" && next.intent === "control_vedere") {
        next.intent = "control_copil";
        next.serviceKeys = [...INTENTS.control_copil.service_keys];
        next.explicitServiceKeys = [];
      }
      if (question.key === "optical_product_type" && option.key === "contact_lenses") {
        next.intent = "lentile_contact";
        next.serviceKeys = resolveOptionServiceKeys(INTENTS.lentile_contact.service_keys, option);
        next.explicitServiceKeys = resolveOptionServiceKeys([], option);
      }
      return next;
    });
  };

  const handleText = (question, value) => {
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    markSearchStarted(state.intent);
    trackPatientSearchEvent("patient_search_free_text_submitted", {
      intent: state.intent || "unknown",
      question_key: question.key,
      text_length_band: textLengthBand(value),
    });
    pushHistory();
    prepareAdaptiveSelection();
    setState((s) => ({
      ...s,
      answers: [...s.answers, { question_key: question.key, answer_value: value }],
      questionHistory: [...new Set([...(s.questionHistory || []), question.key])],
    }));
  };

  // 2026-09-01: pana acum, raspunsul "Niciuna dintre acestea" de la ecranul de siguranta
  // nu se salva nicaieri. Starea de siguranta ramanea "neverificat" la nesfarsit, fluxul
  // de simptome nu se putea incheia, iar furnizorul nu vedea ca pacientul a fost intrebat.
  // Il inregistram sub cheia din catalog, ca sa fie recunoscut server-side.
  const handleSafetyCleared = () => {
    setState((s) => {
      if (s.answers.some((answer) => answer.question_key === "safety_targeted_check")) return s;
      return {
        ...s,
        answers: [...s.answers, { question_key: "safety_targeted_check", answer_value: "niciuna" }],
        questionHistory: [...new Set([...(s.questionHistory || []), "safety_targeted_check"])],
      };
    });
  };

  const handleLocation = (question, { city, locality, clientAddressText }) => {
    matchingRequestRef.current.invalidate();
    markSearchStarted(state.intent);
    pushHistory();
    prepareAdaptiveSelection();
    const questionKey = question?.key || "locatie";
    setState((s) => ({
      ...s,
      scope: "locality",
      city: city || "",
      locality: locality || null,
      clientAddressText: clientAddressText || "",
      answers: [...s.answers, { question_key: questionKey, answer_value: city }],
      questionHistory: [...new Set([...(s.questionHistory || []), questionKey])],
    }));
  };

  const handleConfirmInterpretation = () => {
    interpretationRequestRef.current.invalidate();
    if (!intentProposal?.intent || !INTENTS[intentProposal.intent]) return;
    const confirmedState = initState(intentProposal.intent, initialMessage);
    // Acelasi fix ca la handleCorrectInterpretation: nu lasam categoria generica sa
    // suprascrie lista precisa de servicii pe care AI-ul a identificat-o deja (ex:
    // ophthalmology_consultation vs optometry_consultation - medic vs optometrist).
    if (Array.isArray(intentProposal?.service_keys) && intentProposal.service_keys.length > 0) {
      confirmedState.serviceKeys = [...intentProposal.service_keys];
      confirmedState.explicitServiceKeys = [...intentProposal.service_keys];
    }
    setState(confirmedState);
    setHistory([]);
    setRequestDraft(null);
    prepareAdaptiveSelection();
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
    // Nu stergem intelegerea AI-ului doar pentru ca increderea a fost medie, nu mare.
    // Daca AI-ul a identificat o intentie (chiar daca a cerut clarificare), o pastram —
    // acelasi tipar folosit deja la acceptarea cu incredere mare (initState mai jos,
    // linia ~326). Motorul de intrebari aprobate va sti astfel sa sara direct la
    // intrebarea specifica ce lipseste, in loc sa reporneasca de la intrebarea generica.
    //
    // 2026-09-01: dar asta era corect DOAR cand AI-ul n-a fost sigur si butonul zice
    // "Aleg categoria". Cand AI-ul a fost sigur, butonul zice "Aleg alta nevoie" - adica
    // pacientul tocmai a spus ca interpretarea e gresita. Pastrandu-i intentia, primea
    // exact acelasi lucru pe care il refuzase, fara nicio cale inapoi in afara de butonul
    // browserului. Acum, in cazul asta, pornim curat de la intrebarea de categorie.
    const rejectedConfidentInterpretation = intentProposal?.status === "confirm";
    const correctedState = initState(
      rejectedConfidentInterpretation ? null : (intentProposal?.intent || null),
      initialMessage,
    );
    // initState populeaza serviceKeys din lista generica a categoriei (ex: control_vedere
    // -> control_vedere_adulti). Dar AI-ul a fost adesea mai precis (ex: distinge intre
    // ophthalmology_consultation - un medic - si optometry_consultation - un optometrist).
    // Cand AI-ul a dat o lista explicita de servicii, o folosim pe aceea, nu pe cea generica,
    // ca sa nu pierdem exact distinctia pentru care AI-ul a fost util.
    // Serviciile propuse de AI se pastreaza doar cand pastram si intentia. Daca pacientul
    // a refuzat interpretarea, ar fi absurd sa ramanem cu serviciile ei.
    if (
      !rejectedConfidentInterpretation
      && Array.isArray(intentProposal?.service_keys)
      && intentProposal.service_keys.length > 0
    ) {
      correctedState.serviceKeys = [...intentProposal.service_keys];
      correctedState.explicitServiceKeys = [...intentProposal.service_keys];
    }
    setState(correctedState);
    setHistory([]);
    setRequestDraft(null);
    markSearchStarted(intentProposal?.intent || state.intent);
    trackPatientSearchEvent("patient_search_ai_intent_corrected", {
      proposed_intent: intentProposal?.intent || "unknown",
      confidence_band: intentProposal?.confidence_band || "low",
      agreement_status: intentProposal?.agreement_status || "unknown",
    });
    setIntentProposal(null);
    setQuestionSelection({ status: "idle", question: null });
    setPhase("questions");
  };

  const goBack = () => {
    interpretationRequestRef.current.invalidate();
    matchingRequestRef.current.invalidate();
    const prev = history[history.length - 1];
    if (!prev) return;
    trackPatientSearchEvent("patient_search_reformulation_started", {
      intent: state.intent || "unknown",
      question_key: current?.key || "unknown",
      answered_count: state.answers.length,
    });
    setHistory((h) => h.slice(0, -1));
    prepareAdaptiveSelection();
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
    prepareAdaptiveSelection();
    if (prev) {
      setHistory((items) => items.slice(0, -1));
      setState(prev);
    }
    setPhase("questions");
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
    questionSelectionRequestRef.current.activate();
    matchingRequestRef.current.activate();
    return () => {
      interpretationAttemptedRef.current = false;
      interpretationRequestRef.current.dispose();
      questionSelectionRequestRef.current.dispose();
      matchingRequestRef.current.dispose();
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

  useEffect(() => {
    if (phase !== "questions" || !state.intent) return undefined;
    const requestId = questionSelectionRequestRef.current.begin();
    setQuestionSelection({ status: "pending", question: null });

    (async () => {
      const response = await selectPatientGuidanceNextQuestion({
        search_text: patientLanguageText(initialMessage, state.answers),
        answers: state.answers,
        question_history: state.questionHistory,
        locality_siruta_code: state.locality?.siruta_code || "",
        locality_name: state.city || state.locality?.city_name || "",
        county_code: state.locality?.county_code || "",
        county_name: state.locality?.county_name || "",
      }, {
        timeoutMs: PATIENT_INTERPRETATION_TIMEOUT_MS,
        requestId,
      });
      if (!questionSelectionRequestRef.current.isCurrent(requestId)) return;
      setQuestionSelection(controlledQuestionSelection(response, {
        answers: state.answers,
        questionHistory: state.questionHistory,
      }));
    })().catch(() => {
      if (!questionSelectionRequestRef.current.isCurrent(requestId)) return;
      setQuestionSelection(fallbackQuestionSelection());
    });

    return () => questionSelectionRequestRef.current.invalidate();
  }, [
    phase,
    initialMessage,
    state.intent,
    state.answers,
    state.questionHistory,
    state.locality,
    state.city,
  ]);

  // Rezultatele nu se mai afiseaza inghesuite in cardul din hero: cand faza devine
  // rezultate, navigam pe pagina dedicata /rezultate, care are spatiu pentru
  // lista de locatii, detalii si (ulterior) chat, la fel ca RequestWorkspace.
  useEffect(() => {
    if (phase !== "results" || !Array.isArray(results)) return;
    navigate("/rezultate", { state: { results, meta: matchMeta } });
  }, [phase, results, matchMeta, navigate]);

  useEffect(() => {
    if (phase !== "interpreting" || interpretationAttemptedRef.current) return;
    interpretationAttemptedRef.current = true;
    const requestId = interpretationRequestRef.current.begin();

    (async () => {
      const interpretationResponse = await interpretPatientNeedForConfirmation({
        search_text: initialMessage,
        deterministic_intent: state.intent || "unknown",
        service_keys: state.serviceKeys,
        explicit_confirmed_service_keys: state.explicitServiceKeys,
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
  }, [phase, initialMessage, state.intent, state.serviceKeys]);

  useEffect(() => {
    if (
      phase !== "questions"
      || !state.intent
      || current
      || ["pending", "blocked"].includes(questionSelection.status)
    ) return;
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
  }, [phase, state, current, initialMessage, intentProposal, questionSelection.status]);

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
            .filter((answer) => !["locatie", "locality"].includes(answer.question_key))
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

      {showInitialSafetyBlock ? (
        <UrgencyInterruption
          assessment={{ blocking: true, blocking_flags: initialSafetyFlags }}
          onCorrect={() => setInitialSafetyAcknowledged(true)}
          correctLabel="Nu e o urgenta, continua cautarea"
        />
      ) : (
        <>
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

      {phase === "questions" && state.intent && questionSelection.status === "pending" && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Alegem urmatoarea intrebare relevanta...
        </div>
      )}

      {/* 2026-09-01: aici se trimitea `blocking_flags: []`, deci pacientul primea un ecran
          care ii spune sa opreasca cautarea si sa ceara ajutor medical imediat, fara sa
          spuna pentru ce. Semnalul e cunoscut - serverul a blocat tocmai pentru ca l-a
          detectat - asa ca il recalculam local, cu aceeasi functie deterministica pe care
          o foloseste si serverul, si aratam motivul. */}
      {phase === "questions" && questionSelection.status === "blocked" && (
        <UrgencyInterruption
          assessment={blockedSafetyAssessment}
          onCorrect={goBack}
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
              <h2 className={`font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl ${current.type === "text" && questionPhase === "safety" ? "sr-only" : ""}`}>
                {current.title}
              </h2>
              {current.type === "choice" && <QuestionChoice question={current} onSelect={handleChoice} />}
              {current.type === "text" && (
                <QuestionText
                  question={current}
                  onSubmit={handleText}
                  onPhaseChange={setQuestionPhase}
                  onSafetyCleared={handleSafetyCleared}
                />
              )}
              {current.type === "location" && (
                <QuestionLocation onAnswer={(answer) => handleLocation(current, answer)} />
              )}
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

      {phase === "results" && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center" role="status">
          <p className="text-sm text-muted-foreground">Te ducem catre rezultate...</p>
        </div>
      )}

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
        </>
      )}
    </motion.div>
  );
}
