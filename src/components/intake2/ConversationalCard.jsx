import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { INTENTS, CATEGORY_QUESTION, detectIntentFromText, detectSubIntentPrefill } from "@/lib/intentRegistry";
import QuestionChoice from "./QuestionChoice";
import QuestionText from "./QuestionText";
import QuestionLocation from "./QuestionLocation";
import MatchResults from "./MatchResults";

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

  return { intent, answers, serviceKeys, city: "", scope: "" };
};

export default function ConversationalCard({ initialMessage = "", initialIntent = null }) {
  const [state, setState] = useState(() => initState(initialIntent, initialMessage));
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState("questions"); // questions | submitting | results | error
  const [results, setResults] = useState(null);

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

  const handleLocation = ({ scope, city }) => {
    pushHistory();
    setState((s) => ({
      ...s,
      scope,
      city: city || "",
      answers: [...s.answers, { question_key: "locatie", answer_value: scope === "city" ? city : "oriunde_in_romania" }],
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
        // Module 3E: public search is read-only. Answers stay in client state only —
        // no PatientRequest / PatientRequestAnswer / RequestMatch / SafetyFlag records
        // are created. A request is created only later, by explicit user action + consent.
        const res = await base44.functions.invoke("matchProviders", {
          intent: state.intent,
          service_keys: state.serviceKeys,
          city: state.city,
          scope: state.scope === "national" ? "national" : "city",
          limit: 20,
        });
        setResults(res.data.results || []);
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
      className="w-full max-w-2xl mx-auto bg-white rounded-[1.75rem] p-6 sm:p-10 text-left shadow-[0_24px_70px_rgba(20,20,20,0.12)] border border-black/[0.05]"
    >
      {initialMessage && (
        <p className="mb-6 text-xs" style={{ color: "#9B968D" }}>
          Ai spus: <span className="italic" style={{ color: "#6B675F" }}>&bdquo;{initialMessage}&rdquo;</span>
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
                className="h-full rounded-full"
                style={{ backgroundColor: "#171717" }}
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
              <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight" style={{ color: "#141414" }}>
                {current.title}
              </h2>
              {current.type === "choice" && <QuestionChoice question={current} onSelect={handleChoice} />}
              {current.type === "text" && <QuestionText question={current} onSubmit={handleText} />}
              {current.type === "location" && <QuestionLocation onAnswer={handleLocation} />}
            </motion.div>
          </AnimatePresence>

          {intentDef?.notice && (
            <p className="mt-7 text-xs leading-relaxed" style={{ color: "#A5A099" }}>{intentDef.notice}</p>
          )}
        </>
      )}

      {phase === "submitting" && (
        <div className="flex items-center gap-2.5 py-10 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cautam cele mai potrivite optiuni pentru tine...
        </div>
      )}

      {phase === "results" && <MatchResults results={results} />}

      {phase === "error" && (
        <div className="py-6">
          <p className="text-sm text-muted-foreground">Ceva nu a functionat. Incearca din nou.</p>
          <button
            type="button"
            onClick={() => setPhase("questions")}
            className="mt-4 px-5 py-2.5 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: "#171717" }}
          >
            Incearca din nou
          </button>
        </div>
      )}
    </motion.div>
  );
}