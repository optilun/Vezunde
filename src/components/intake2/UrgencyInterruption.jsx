import React from "react";
import { AlertTriangle, ArrowLeft, Droplets, Hospital, ShieldAlert } from "lucide-react";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";
import { PATIENT_EMERGENCY_GUIDANCE_COPY } from "../../../shared/patientEmergencyGuidance.js";

function flagLabels(assessment) {
  const flags = assessment?.blocking_flags?.length
    ? assessment.blocking_flags
    : (assessment?.advisory_flags || []);
  return flags
    .map((flag) => PATIENT_SAFETY_FLAG_PRESENTATION[flag])
    .filter(Boolean);
}

export default function UrgencyInterruption({ assessment, mode = "blocking", onCorrect }) {
  const labels = flagLabels(assessment);
  const chemical = [...(assessment?.blocking_flags || []), ...(assessment?.advisory_flags || [])].includes("chemical_injury");
  const blocking = mode === "blocking";

  return (
    <section data-component="UrgencyInterruption" className="rounded-[22px] border border-red-300/70 bg-red-50 p-5 text-red-950 shadow-[0_14px_40px_rgba(127,29,29,0.08)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-red-700">Informatii de siguranta</p>
          <h2 className="mt-1 font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
            {blocking ? "Opreste cautarea si solicita ajutor medical imediat" : "Cererea contine un posibil semnal de urgenta"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-red-900/85">
            {blocking
              ? "VIASEE nu poate stabili cauza sau gravitatea simptomelor. Nu astepta recomandari sau raspunsuri in platforma."
              : "VIASEE nu poate stabili cauza sau gravitatea simptomelor. Raspunde la intrebarile de clarificare; cautarea ramane oprita pana cand situatia este clarificata."}
          </p>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-white/70 p-4">
          <p className="text-xs font-extrabold text-red-950">Semnal identificat</p>
          <ul className="mt-2 space-y-2">
            {labels.map((label) => (
              <li key={label} className="flex items-start gap-2 text-xs leading-relaxed text-red-900/85">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-700" /> {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {blocking ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-white/70 p-4 text-sm leading-relaxed text-red-950">
          <Hospital className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
          <div className="space-y-2">
            <p><strong>{PATIENT_EMERGENCY_GUIDANCE_COPY.primary_instruction}</strong></p>
            <p>{PATIENT_EMERGENCY_GUIDANCE_COPY.fallback_instruction}</p>
            <p>{PATIENT_EMERGENCY_GUIDANCE_COPY.transport_instruction}</p>
            <p className="text-xs text-red-900/80">{PATIENT_EMERGENCY_GUIDANCE_COPY.emergency_call_instruction}</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p><strong>Clarifica mai intai situatia.</strong> VIASEE nu afiseaza instructiunea de urgenta pana cand semnalul nu este confirmat prin raspunsurile tale.</p>
        </div>
      )}

      {blocking && chemical && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <p className="text-xs leading-relaxed"><strong>Daca a ajuns o substanta chimica in ochi:</strong> clateste imediat cu apa curata cel putin 20 de minute, indeparteaza lentilele de contact daca se desprind usor si nu freca ochiul. Continua apoi spre urgenta.</p>
        </div>
      )}

      {onCorrect && (
        <div className="mt-5">
          <button type="button" onClick={onCorrect} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-5 text-sm font-bold text-red-950 hover:bg-red-100/60">
            <ArrowLeft className="h-4 w-4" /> Am selectat gresit. Corecteaza raspunsul
          </button>
        </div>
      )}

      <p className="mt-5 text-[11px] leading-relaxed text-red-900/70">Acest mesaj este informational si nu reprezinta diagnostic sau triaj medical.</p>
    </section>
  );
}
