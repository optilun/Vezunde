import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { matchProvidersWithSemanticFallback } from "@/lib/providerSemanticSearch";
import { INTENTS, CATEGORY_QUESTION, detectIntentFromText, detectSubIntentPrefill } from "@/lib/intentRegistry";
import QuestionChoice from "./QuestionChoice";
import QuestionText from "./QuestionText";
import QuestionLocation from "./QuestionLocation";
import MatchResults from "./MatchResults";
import SearchingTransition from "./SearchingTransition";

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
        if (option.service_keys) serviceKeys = [...new Set([...serviceKeys, ...option.service_keys])];
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
    clientLocation: null,
    clientAddressText: "",
  };
};

export default function ConversationalCard({ initialMessage = "", initialIntent = null }) {
  const [state, setState] = useState(() => initState(initialIntent, initialMessage));
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState("questions"); // questions | submitting | results | error
  const [results, setResults] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null);

  const intentDef = state.intent ? INTENTS[state.intent] : null;
  const questions = intentDef ? intentDef.questions : [CATEGORY_QUESTION];
  const answeredKeys = state.answers.map((a) => a.question_key);
  const current = questions.find((q) => !answeredKeys.includes(q.key));
  const total = state.answers.length + questions.filter((q) => !answeredKeys.includes(q.key)).length;
  const progress = total > 0 ? Math.round((state.answers.length / total) * 100) : 0;

  const pushHistory = () => setHistory((h) => [...h, state]);

  const handleChoice = (question, option) => {
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
      if (option.service_keys) next.serviceKeys = [...new Set([...next.serviceKeys, ...option.service_keys])];
      if (option.next_intent && INTENTS[option.next_intent]) {
        next.intent = option.next_intent;
        next.serviceKeys = [...INTENTS[option.next_intent].service_keys];
      }
      return next;
    });
  };

  const handleText = (question, value) => {
    pushHistory();
    setState((s) => ({ ...s, answers: [...s.answers, { question_key: question.key, answer_value: value }] }));
  };

  const handleLocation = ({ scope, city, locality, clientLocation, clientAddressText }) => {
    pushHistory();
    const answerValue = scope === "nearby"
      ? "locatia_curenta"
      : scope === "city"
        ? city
        : "oriunde_in_romania";
    setState((s) => ({
      ...s,
      scope,
      city: city || "",
      locality: locality || null,
      clientLocation: clientLocation || null,
      clientAddressText: clientAddressText || "",
      answers: [...s.answers, { question_key: "locatie", answer_value: answerValue }],
    }));
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setState(prev);
  };

  useEffect(() => {
    if (phase !== "questions" || !state.intent || current) return;
    setPhase("submitting");
    (async () => {
      try {
        const res = await matchProvidersWithSemanticFallback({
          search_text: initialMessage,
          intent: state.intent,
          service_keys: state.serviceKeys,
          city: state.city,
          locality_siruta_code: state.locality?.siruta_code || "",
          county: state.locality?.county_name || "",
          scope: state.scope === "national" ? "national" : state.scope === "nearby" ? "nearby" : "city",
          client_lat: state.clientLocation?.lat ?? null,
          client_lng: state.clientLocation?.lng ?? null,
          client_location_source: state.clientLocation?.source || "",
          client_location_accuracy_m: state.clientLocation?.accuracy_m || null,
          client_address_text: state.clientAddressText || "",
          limit: 20,
        });
        setResults(res.data.results || []);
        setMatchMeta({
          routing_mode: res.data.routing_mode || null,
          coverage_status: res.data.coverage_status || null,
          client_location_source: res.data.client_location_source || null,
          client_address_text: res.data.client_address_text || state.clientAddressText || "",
        });
        setPhase("results");
      } catch (e) {
        setPhase("error");
      }
    })();
  }, [phase, state, current, initialMessage]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="w-full max-w-2xl mx-auto bg-card rounded-[1.75rem] p-6 sm:p-10 text-left shadow-[0_24px_70px_rgba(20,20,20,0.12)] border border-border"
    >
      {initialMessage && (
        <p className="mb-6 text-xs text-muted-foreground">
          Ai spus: <span className="italic">&bdquo;{initialMessage}&rdquo;</span>
        </p>
      )}

      {phase === "questions" && current && (
        <>
          <div className="flex items-center gap-4 mb-6">
            {history.length > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Inapoi
              </button>
            ) : <span />}
            <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${Math.max(progress, 4)}%` }}
                transition={{ duration: 0.35 }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${state.intent || "categorie"}-${current.key}`}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.22 }}
            >
              <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
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
            onClick={() => setPhase("questions")}
            className="mt-4 px-5 py-2.5 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Incearca din nou
          </button>
        </div>
      )}
    </motion.div>
  );
}
