import React, { useMemo } from "react";
import { ArrowLeft, CheckCircle2, Lightbulb, MapPin, Search } from "lucide-react";
import { storePatientRequestDraft } from "@/lib/patientRequestPersistenceClient";
import { intentDisplayLabel } from "@/lib/intentRegistry";
import { PATIENT_ANAMNESIS_KEY_PREFIX, isPatientAnamnesisKey } from "@/lib/patientAnamnesis";
import { buildPatientVisitGuidance } from "@/lib/patientVisitGuidance";
import { getCanonicalServiceDefinition, normalizeServiceKey } from "../../../shared/canonicalServiceRegistryExtended.js";

const FREE_TEXT_KEYS = new Set(["descriere", "symptom_description", "investigation_reference_text"]);

function comparableText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detailRows(draft) {
  const excluded = new Set(["categorie", "locatie"]);
  const original = comparableText(draft?.original_message);
  return (draft?.answers || []).filter((answer) => (
    !excluded.has(answer.question_key)
    && !isPatientAnamnesisKey(answer.question_key)
    // Descrierea precompletata si trimisa neschimbata apare deja la "Ai descris".
    && !(FREE_TEXT_KEYS.has(answer.question_key) && original && comparableText(answer.answer_value) === original)
  ));
}

function anamnesisRows(draft) {
  return (draft?.answers || []).filter((answer) => answer.question_key?.startsWith(PATIENT_ANAMNESIS_KEY_PREFIX));
}

// 2026-09-24: recomandari pentru vizita (text fix, vezi src/lib/patientVisitGuidance.js),
// alese dupa nevoie, anamneza si cuvintele pacientului.
function visitGuidance(draft) {
  const text = [
    draft?.original_message,
    ...(draft?.answers || [])
      .filter((answer) => FREE_TEXT_KEYS.has(answer.question_key))
      .map((answer) => answer.answer_value),
  ].filter(Boolean).join(". ");
  const serviceKeys = (draft?.service_keys || [])
    .map((key) => normalizeServiceKey(key).canonicalKey)
    .filter(Boolean);
  return buildPatientVisitGuidance({ intent: draft?.intent, answers: draft?.answers || [], text, serviceKeys });
}

// 2026-09-24: pacientul vede si ce servicii vom cauta, cu etichetele din registrul canonic.
// Cheile vechi (ex. control_vedere_adulti) sunt traduse in serviciul canonic echivalent.
function serviceLabels(draft, limit = 4) {
  const labels = [];
  for (const key of draft?.service_keys || []) {
    const canonicalKey = normalizeServiceKey(key).canonicalKey;
    const label = canonicalKey ? getCanonicalServiceDefinition(canonicalKey)?.label : null;
    if (label && !labels.includes(label)) labels.push(label);
    if (labels.length >= limit) break;
  }
  return labels;
}

export default function PatientRequestReview({ draft, onConfirm, onEdit }) {
  const rows = detailRows(draft);
  const historyRows = anamnesisRows(draft);
  const services = serviceLabels(draft);
  const guidance = useMemo(() => visitGuidance(draft), [draft]);
  const handleConfirm = () => {
    storePatientRequestDraft(draft);
    onConfirm?.();
  };

  return (
    <div className="py-1 sm:py-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Verifică înainte de căutare
      </div>

      <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Am pregătit cererea ta
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Verifică nevoia și localitatea, apoi caută opțiunile disponibile.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-secondary/35 p-4 sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Nevoie</p>
          <p className="mt-1 text-base font-semibold text-foreground">
            {intentDisplayLabel(draft?.intent) || draft?.intent_label || "Nu sunt sigur"}
          </p>
          {services.length > 0 && (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Căutăm: {services.join(" · ")}
            </p>
          )}
        </div>

        {draft?.city && (
          <div className="mt-4 flex items-start gap-2 border-t border-border/70 pt-4">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Localitate</p>
              <p className="mt-1 text-sm font-medium text-foreground">{draft.city}</p>
            </div>
          </div>
        )}

        {draft?.original_message && (
          <div className="mt-4 border-t border-border/70 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Ai descris</p>
            <p className="mt-1 text-sm leading-relaxed text-foreground">„{draft.original_message}”</p>
          </div>
        )}

        {rows.length > 0 && (
          <dl className="mt-4 space-y-3 border-t border-border/70 pt-4">
            {rows.map((answer) => (
              <div key={answer.question_key} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-medium text-muted-foreground">{answer.question_label}</dt>
                <dd className="text-sm font-medium text-foreground sm:text-right">{answer.answer_label}</dd>
              </div>
            ))}
          </dl>
        )}

        {historyRows.length > 0 && (
          <div className="mt-4 border-t border-border/70 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Anamneză</p>
            <dl className="mt-2 space-y-2">
              {historyRows.map((answer) => (
                <div key={answer.question_key} className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-xs font-medium text-muted-foreground">{answer.question_label}</dt>
                  <dd className="text-sm font-medium text-foreground sm:text-right">{answer.answer_label}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-labelledby="visit-guidance-title">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
          <p id="visit-guidance-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Recomandări pentru vizită
          </p>
        </div>
        <p className="mt-2.5 text-sm font-medium leading-relaxed text-foreground">{guidance.where}</p>
        {guidance.prepare.length > 0 && (
          <>
            <p className="mt-3 text-xs font-semibold text-foreground">Cum te pregătești</p>
            <ul className="mt-1.5 space-y-1.5">
              {guidance.prepare.map((tip) => (
                <li key={tip} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {tip}
                </li>
              ))}
            </ul>
          </>
        )}
        {guidance.notes.map((note) => (
          <div key={note.key} className="mt-3 border-t border-border/70 pt-3">
            <p className="text-xs font-semibold text-foreground">{note.title}</p>
            <ul className="mt-1.5 space-y-1.5">
              {note.points.map((point) => (
                <li key={point} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {guidance.safety_net && (
          <p className="mt-3 border-t border-border/70 pt-3 text-xs leading-relaxed text-foreground/80">{guidance.safety_net}</p>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{guidance.disclaimer}</p>
      </section>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Search className="h-4 w-4" />
          Caută rezultate
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Modifică ultimul răspuns
        </button>
      </div>


    </div>
  );
}
