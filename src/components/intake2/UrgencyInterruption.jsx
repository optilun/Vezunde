import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, PhoneCall, ShieldAlert } from "lucide-react";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";
import { APPROVED_PATIENT_SAFETY_COPY } from "../../../shared/patientGuidanceQuestionCatalog.js";

// 2026-09-02: textul de urgenta vine din APPROVED_PATIENT_SAFETY_COPY, nu mai e copiat aici.
// Era duplicat, iar duplicatul chiar divergease: ecranul spunea "cat mai curand" acolo unde
// textul aprobat spune "imediat". Pe cel mai critic ecran al aplicatiei, o copie care se
// poate abate tacut de la formularea aprobata medical nu e acceptabila.
const COPY = APPROVED_PATIENT_SAFETY_COPY;

// 2026-09-02, a treia trecere. Ecranul e medical, deci trebuie sa arate sobru, nu decorat.
// Au disparut toate ornamentele: textura, umbra, banda groasa, medalionul cu sigiliu, placa
// colorata de prim ajutor. Nu mai exista nicio suprafata umpluta cu culoare.
//
// Ce a ramas e o fisa: o linie subtire caramizie sus, care spune ca documentul asta e
// serios, si patru sectiuni cu acelasi tipar - eticheta mono mica, apoi continutul. Aceeasi
// axa de aliniere pentru tot, acelasi ritm vertical, linii de par intre sectiuni.
//
//   Semnal identificat  - ce a fost detectat
//   Primul ajutor, acum - doar cand exista o precautie aprobata pentru semnalul respectiv
//   Unde mergi          - destinatia, plus precautiile de transport
//   [actiuni]           - apoi textul marunt
//
// Ordinea respecta docs/patient-emergency-guidance-policy.md: primul ajutor INAINTEA
// destinatiei (sectiunea 3), spitalul inaintea lui 112, iar 112 conditionat si niciodata ca
// actiune principala (sectiunea 5). Precedenta din sectiunea 3 e implementata mai jos:
// traumatismul penetrant suprima instructiunea de clatire.
const ACCENT = "#b4573a";

function flagLabels(assessment) {
  const flags = assessment?.blocking_flags?.length
    ? assessment.blocking_flags
    : (assessment?.advisory_flags || []);
  return flags
    .map((flag) => PATIENT_SAFETY_FLAG_PRESENTATION[flag])
    .filter(Boolean);
}

function FieldLabel({ children }) {
  return <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-black/40">{children}</p>;
}

export default function UrgencyInterruption({ assessment, mode = "blocking", onCorrect, correctLabel = "Am selectat greșit. Corectează răspunsul" }) {
  const labels = flagLabels(assessment);
  const allFlags = [...(assessment?.blocking_flags || []), ...(assessment?.advisory_flags || [])];
  const blocking = mode === "blocking";

  // Politica, sectiunea 3: cand sunt prezente ambele, precautia pentru obiect patruns are
  // prioritate si instructiunea de clatire se suprima.
  const firstAid = allFlags.includes("penetrating_or_high_speed_trauma")
    ? COPY.penetrating_instruction
    : (allFlags.includes("chemical_injury") ? COPY.chemical_instruction : "");

  return (
    <section
      data-component="UrgencyInterruption"
      className="relative overflow-hidden rounded-[1.25rem] border border-[#ddd6c7] bg-white"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: ACCENT }} />

      <div className="px-5 pb-6 pt-7 sm:px-8 sm:pb-8 sm:pt-9">
        <div className="max-w-[42rem]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
              {COPY.eyebrow}
            </p>
          </div>

          <h2 className="mt-3.5 font-heading text-[1.45rem] font-extrabold leading-[1.08] tracking-[-0.04em] text-[#1c1c1c] sm:text-[1.75rem]">
            {blocking ? COPY.blocking_title : COPY.advisory_title}
          </h2>
        </div>

        <div className="mt-7 max-w-[42rem] divide-y divide-[#ece7dc] border-y border-[#ece7dc]">
          {labels.length > 0 && (
            <div className="py-4">
              <FieldLabel>Semnal identificat</FieldLabel>
              <ul className="mt-1.5 space-y-1">
                {labels.map((label) => (
                  <li key={label} className="font-heading text-[14px] font-bold leading-snug tracking-[-0.015em] text-[#1c1c1c]">
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {firstAid && (
            <div className="py-4">
              <FieldLabel>Primul ajutor, acum</FieldLabel>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#1c1c1c]">{firstAid}</p>
            </div>
          )}

          <div className="py-4">
            <FieldLabel>Unde mergi</FieldLabel>
            <p className="mt-1.5 font-heading text-[15.5px] font-extrabold leading-snug tracking-[-0.02em] text-[#1c1c1c] sm:text-[16.5px]">
              {COPY.primary_instruction}
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {[
                "Nu conduce singur dacă vederea îți este afectată — roagă pe cineva să te ducă.",
                "VIASEE nu poate confirma care locații au gardă activă acum — sună înainte, sau mergi direct la cea mai apropiată unitate de urgență.",
              ].map((line) => (
                <li key={line} className="flex gap-2 text-[13px] leading-relaxed text-black/55">
                  <span aria-hidden="true" className="mt-[8px] h-[3px] w-[3px] shrink-0 rounded-full bg-black/30" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex max-w-[42rem] flex-col gap-2.5">
          <Link
            to="/cauta?q=oftalmolog"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#171717] px-6 font-heading text-[13.5px] font-bold tracking-[-0.01em] text-white transition-opacity hover:opacity-90"
          >
            Găsește clinici și cabinete oftalmologice lângă tine <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href="tel:112"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#ddd6c7] px-5 font-heading text-[12.5px] font-bold tracking-[-0.01em] text-[#1c1c1c] transition-colors hover:bg-[#faf7f0]"
            >
              <PhoneCall className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Sună la 112 (dacă nu te poți deplasa singur sau starea se agravează)
            </a>
            {onCorrect && (
              <button
                type="button"
                onClick={onCorrect}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#ece7dc] px-5 font-heading text-[12.5px] font-bold tracking-[-0.01em] text-muted-foreground transition-colors hover:bg-[#faf7f0] hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {correctLabel}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 max-w-[42rem] space-y-1.5">
          <p className="text-[11.5px] leading-relaxed text-black/40">{COPY.explanation}</p>
          <p className="text-[11.5px] leading-relaxed text-black/40">{COPY.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
