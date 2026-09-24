import React, { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Pencil, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";
import { CATEGORY_QUESTION, INTENT_DISPLAY, TIMING_OPTIONS } from "@/lib/intentRegistry";
import { PATIENT_GUIDANCE_QUESTION_CATALOG } from "../../../shared/patientGuidanceQuestionCatalog.js";

// 2026-09-24 (audit LLM cautare/recomandare): toate textele de pe acest ecran vin din copia
// aprobata a aplicatiei (INTENT_DISPLAY, catalogul de intrebari, CATEGORY_QUESTION). Modelul
// nu scrie nimic din ce citeste pacientul: el doar propune o intentie si cateva indicii.

const FOR_WHOM_LABELS = {
  child: "Pentru copil",
  other_adult: "Pentru altcineva",
};

function optionLabel(questionKey, optionKey) {
  const question = PATIENT_GUIDANCE_QUESTION_CATALOG[questionKey];
  return question?.options?.find((option) => option.key === optionKey)?.label || "";
}

function understoodDetails(hints = {}) {
  const details = [];
  if (FOR_WHOM_LABELS[hints.for_whom]) details.push(FOR_WHOM_LABELS[hints.for_whom]);
  const age = hints.for_whom === "child" ? optionLabel("child_age_group", hints.child_age_group) : "";
  if (age) details.push(`Vârsta: ${age}`);
  const timing = TIMING_OPTIONS.find((option) => option.key === hints.timing && !option.hidden)?.label;
  if (timing) details.push(timing);
  if (hints.locality_query) details.push(`Localitate: ${hints.locality_query}`);
  return details;
}

// Variantele de ales: categoriile aprobate, plus intentia propusa de model cand nu e printre
// ele (control pentru copil, lentile de contact). Sugestiile sunt doar marcate, nu preselectate.
function choiceOptions(proposal, { markSuggestions }) {
  const suggested = new Set(markSuggestions
    ? [proposal?.intent, proposal?.alternative_intent].filter(Boolean)
    : [proposal?.alternative_intent].filter(Boolean));
  const base = CATEGORY_QUESTION.options.map((option) => ({ key: option.key, label: option.label }));
  const known = new Set(base.map((option) => option.key));
  const extra = [...suggested]
    .filter((key) => !known.has(key) && INTENT_DISPLAY[key])
    .map((key) => ({ key, label: INTENT_DISPLAY[key].label }));
  return [...extra, ...base].map((option) => ({ ...option, suggested: suggested.has(option.key) }));
}

export default function PatientIntentConfirmation({
  proposal,
  intentLabel,
  contextHints = {},
  onConfirm,
  onCorrect,
}) {
  const [choosing, setChoosing] = useState(false);
  const requiresManualChoice = proposal?.status !== "confirm";
  const showChoices = requiresManualChoice || choosing;
  const safetyFlags = proposal?.possible_safety_flags || [];
  const hasSafetySignal = safetyFlags.length > 0;
  // 2026-09-01 (audit cautare/recomandare LLM, sectiunea 3.3): inainte, mesajul de aici
  // era generic si nu spunea ce anume s-a detectat. Acum arata semnalele identificate.
  // Aici e singurul semnal de siguranta bazat pe interpretarea AI care ajunge efectiv la
  // pacient in timp real (verificarea deterministica din ConversationalCard.jsx acopera
  // formularile cunoscute; acesta e advisory, pentru restul) - de aceea ramane fara
  // instructiuni de urgenta, vezi comentariul din bloc.
  const safetyLabels = safetyFlags
    .map((flag) => PATIENT_SAFETY_FLAG_PRESENTATION[flag])
    .filter(Boolean);
  const phrase = INTENT_DISPLAY[proposal?.intent]?.phrase
    || String(intentLabel || "acest serviciu").toLowerCase();
  const details = understoodDetails(contextHints);
  const fromDeterministicMatch = proposal?.source === "deterministic";

  return (
    <div className="py-2 sm:py-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {fromDeterministicMatch ? "Am analizat descrierea ta" : "Interpretare asistată"}
      </div>

      {showChoices ? (
        <>
          <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Ce descrie cel mai bine nevoia ta?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {requiresManualChoice
              ? "Din mesaj nu reiese sigur ce cauți. Alege varianta potrivită și continuăm cu întrebările potrivite pentru ea."
              : "Alege varianta potrivită și continuăm cu întrebările potrivite pentru ea."}
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {`Am înțeles că ai nevoie de ${phrase}.`}
          </h2>
          {details.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Am reținut din mesaj
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {details.map((detail) => (
                  <li
                    key={detail}
                    className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Confirmă și continuăm cu câteva întrebări scurte. Ce ai scris deja apare marcat ca sugestie, ca să nu completezi totul de la zero. AI-ul nu alege furnizorii și nu stabilește ordinea rezultatelor.
          </p>
        </>
      )}

      {hasSafetySignal && (
        <div className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-950">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Formularea poate conține un semnal care merită evaluare rapidă. VIASEE nu pune diagnostic și nu stabilește dacă situația este sau nu urgentă.
            </p>
          </div>
          {safetyLabels.length > 0 && (
            <ul className="mt-3 space-y-1 pl-8 text-xs">
              {safetyLabels.map((label) => (
                <li key={label} className="list-disc">{label}</li>
              ))}
            </ul>
          )}
          {/* docs/patient-emergency-guidance-policy.md sectiunile 4 si 5: un semnal advisory
              (derivat din interpretarea AI, nu din verificarea deterministica) NU poate afisa
              instructiuni de destinatie de urgenta, prim ajutor sau numarul 112. Acelea apar
              doar in UrgencyInterruption, pe stare blocking confirmata determinist. Aici
              ramane semnalul, precizarea ca VIASEE nu pune diagnostic si intrebarea de
              clarificare (Da, continua / Aleg alta nevoie). Verificarea de siguranta
              deterministica urmeaza oricum in chestionar, inainte de distribuirea cererii. */}
          <p className="mt-3 pl-8 text-xs leading-relaxed">
            Dacă simptomele sunt severe, au apărut brusc sau se agravează, cere o evaluare medicală fără să aștepți un răspuns în platformă.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 pl-8">
            <Link
              to="/cauta?q=oftalmolog"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3.5 text-xs font-bold text-amber-950 hover:bg-amber-100/60"
            >
              <Search className="h-3.5 w-3.5" /> Cabinete oftalmologice lângă tine
            </Link>
          </div>
        </div>
      )}

      {showChoices ? (
        <div className="mt-6 grid gap-2.5">
          {choiceOptions(proposal, { markSuggestions: requiresManualChoice }).map((option) => (
            <ChoiceCard
              key={option.key}
              label={option.label}
              suggested={option.suggested}
              onClick={() => onCorrect?.(option.key)}
            />
          ))}
          {!requiresManualChoice && (
            <button
              type="button"
              onClick={() => setChoosing(false)}
              className="mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Înapoi la ce am înțeles
            </button>
          )}
        </div>
      ) : (
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Check className="h-4 w-4" />
            Da, continuă
          </button>
          <button
            type="button"
            onClick={() => setChoosing(true)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            <Pencil className="h-4 w-4" />
            Nu, aleg altă nevoie
          </button>
        </div>
      )}
    </div>
  );
}
