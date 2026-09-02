import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Droplets, PhoneCall, Search, ShieldAlert } from "lucide-react";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";
import { APPROVED_PATIENT_SAFETY_COPY } from "../../../shared/patientGuidanceQuestionCatalog.js";

// 2026-09-02: textul de urgenta vine acum din APPROVED_PATIENT_SAFETY_COPY, nu mai e copiat
// aici. Era duplicat, iar duplicatul chiar divergease: ecranul spunea "cat mai curand" acolo
// unde textul aprobat spune "imediat". Pe cel mai critic ecran al aplicatiei, o copie care
// se poate abate tacut de la formularea aprobata medical nu e acceptabila.
const COPY = APPROVED_PATIENT_SAFETY_COPY;

function flagLabels(assessment) {
  const flags = assessment?.blocking_flags?.length
    ? assessment.blocking_flags
    : (assessment?.advisory_flags || []);
  return flags
    .map((flag) => PATIENT_SAFETY_FLAG_PRESENTATION[flag])
    .filter(Boolean);
}

export default function UrgencyInterruption({ assessment, mode = "blocking", onCorrect, correctLabel = "Am selectat greșit. Corectează răspunsul" }) {
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
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-red-700">{COPY.eyebrow}</p>
          <h2 className="mt-1 font-heading text-xl font-extrabold tracking-tight sm:text-2xl">
            {blocking ? COPY.blocking_title : COPY.advisory_title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-red-900/85">
            {COPY.explanation}
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

      <div className="mt-5 space-y-3 text-sm leading-relaxed text-red-950">
        <p><strong>{COPY.primary_instruction}</strong></p>
        <p>Nu conduce singur dacă vederea îți este afectată — roagă pe cineva să te ducă.</p>
        <p>VIASEE nu poate confirma care locații au gardă activă acum — sună înainte, sau mergi direct la cea mai apropiată unitate de urgență.</p>
      </div>

      {chemical && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <p className="text-xs leading-relaxed">{COPY.chemical_instruction}</p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2.5">
        <Link
          to="/cauta?q=oftalmolog"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-700 px-5 text-sm font-extrabold text-white transition-opacity hover:opacity-90"
        >
          <Search className="h-4 w-4" /> Găsește clinici și cabinete oftalmologice lângă tine
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a href="tel:112" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-5 text-xs font-bold text-red-950 hover:bg-red-100/60">
            <PhoneCall className="h-3.5 w-3.5" /> Sună la 112 (dacă nu te poți deplasa singur sau starea se agravează)
          </a>
          {onCorrect && (
            <button type="button" onClick={onCorrect} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-5 text-xs font-bold text-red-950 hover:bg-red-100/60">
              <ArrowLeft className="h-3.5 w-3.5" /> {correctLabel}
            </button>
          )}
        </div>
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-red-900/70">{COPY.disclaimer}</p>
    </section>
  );
}
