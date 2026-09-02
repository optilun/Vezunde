import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Droplets, PhoneCall, ShieldAlert } from "lucide-react";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";
import { APPROVED_PATIENT_SAFETY_COPY } from "../../../shared/patientGuidanceQuestionCatalog.js";

// 2026-09-02: textul de urgenta vine din APPROVED_PATIENT_SAFETY_COPY, nu mai e copiat aici.
// Era duplicat, iar duplicatul chiar divergease: ecranul spunea "cat mai curand" acolo unde
// textul aprobat spune "imediat". Pe cel mai critic ecran al aplicatiei, o copie care se
// poate abate tacut de la formularea aprobata medical nu e acceptabila.
const COPY = APPROVED_PATIENT_SAFETY_COPY;

// 2026-09-02, a doua trecere. Prima versiune adusese ecranul in paleta VIASEE, dar ramasese
// incarcat: douasprezece blocuri stivuite, doua placi tonale una sub alta si trei paragrafe
// gri de aceeasi greutate, in care ochiul nu stia unde sa se opreasca.
//
// Acum sunt patru grupuri, in ordinea in care conteaza:
//   1. ce s-a detectat  - supratitlu, titlu, semnalul pe o linie cu accent lateral
//   2. ce faci acum     - primul ajutor (daca exista), apoi destinatia
//   3. cu ce sa mergi   - precautiile, compacte
//   4. actiuni + subsol - butoane, apoi textul marunt
//
// Doua schimbari de fond fata de prima versiune:
//   - Semnalul nu mai e o placa plina, ci o linie cu bara laterala caramizie. Ramane o
//     singura suprafata colorata pe ecran - primul ajutor - si aceea chiar merita atentia.
//   - COPY.explanation ("VIASEE nu poate stabili cauza...") a coborat langa disclaimer.
//     Sunt amandoua limitari ale platformei, nu instructiuni; sus ocupau doua randuri intre
//     titlu si semnal si intarziau exact informatia pentru care pacientul e acolo.
//
// ORDINEA, corectata: docs/patient-emergency-guidance-policy.md sectiunea 3 cere ca primul
// ajutor sa apara INAINTEA indrumarii spre destinatie, asa cum face si constructorul canonic
// buildPatientEmergencyGuidanceMessage. Ecranul il punea dupa, de dinaintea restilizarii.
// Sectiunea 5 ramane respectata: spitalul primul, 112 dupa el, conditionat, ca pastila
// secundara, niciodata actiune principala.
const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

// Caramiziul din paleta de categorii, folosit si pe placile din workspace.
const ACCENT = "#b4573a";
const SEAL_TONE = { borderColor: "#e1bda8", backgroundColor: "#efd5c5" };
const FIRST_AID_TONE = { borderColor: "#c6d3da", backgroundColor: "#dce5e9" };

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
    <section
      data-component="UrgencyInterruption"
      className="relative overflow-hidden rounded-[1.75rem] border border-[#d9c3b4] bg-[#fdfbf6] px-5 py-6 shadow-[0_18px_48px_rgba(34,30,24,0.05)] sm:px-8 sm:py-8"
    >
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={GRAIN} />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: ACCENT }} />

      <div className="relative z-10 max-w-[46rem]">
        {/* 1. Ce s-a detectat */}
        <div className="flex items-center gap-3">
          <span
            style={SEAL_TONE}
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[#7d3520]"
          >
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <ShieldAlert className="relative z-10 h-[18px] w-[18px]" />
          </span>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[#8a412b]">{COPY.eyebrow}</p>
        </div>

        <h2 className="mt-4 font-heading text-[1.55rem] font-extrabold leading-[1.04] tracking-[-0.045em] text-[#1c1c1c] sm:text-[2rem]">
          {blocking ? COPY.blocking_title : COPY.advisory_title}
        </h2>

        {labels.length > 0 && (
          <div className="mt-5 border-l-2 pl-4" style={{ borderColor: ACCENT }}>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-black/45">Semnal identificat</p>
            <ul className="mt-1 space-y-0.5">
              {labels.map((label) => (
                <li key={label} className="font-heading text-[14px] font-bold leading-snug tracking-[-0.015em] text-[#1c1c1c]">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 2. Ce faci acum. Primul ajutor inaintea destinatiei, conform politicii. */}
        {chemical && (
          <div style={FIRST_AID_TONE} className="relative mt-6 flex items-start gap-3 overflow-hidden rounded-[1.4rem] border px-5 py-4">
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <Droplets className="relative z-10 mt-0.5 h-4 w-4 shrink-0 text-[#3d5a68]" />
            <p className="relative z-10 text-[13.5px] leading-relaxed text-black/75">{COPY.chemical_instruction}</p>
          </div>
        )}

        <p className="mt-6 font-heading text-[17px] font-extrabold leading-snug tracking-[-0.025em] text-[#1c1c1c] sm:text-[19px]">
          {COPY.primary_instruction}
        </p>

        {/* 3. Cu ce sa mergi. Precautii, nu instructiuni principale: mai mici, marcate discret. */}
        <ul className="mt-4 space-y-2">
          {[
            "Nu conduce singur dacă vederea îți este afectată — roagă pe cineva să te ducă.",
            "VIASEE nu poate confirma care locații au gardă activă acum — sună înainte, sau mergi direct la cea mai apropiată unitate de urgență.",
          ].map((line) => (
            <li key={line} className="flex gap-2.5 text-[13.5px] leading-relaxed text-black/60">
              <span aria-hidden="true" className="mt-[9px] h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
              {line}
            </li>
          ))}
        </ul>

        {/* 4. Actiuni, apoi subsolul cu limitarile platformei. */}
        <div className="mt-7 flex flex-col gap-2.5">
          <Link
            to="/cauta?q=oftalmolog"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#171717] px-6 font-heading text-[13.5px] font-bold tracking-[-0.01em] text-white transition-opacity hover:opacity-90"
          >
            Găsește clinici și cabinete oftalmologice lângă tine <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href="tel:112"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d9c3b4] bg-white/70 px-5 font-heading text-[12.5px] font-bold tracking-[-0.01em] text-[#1c1c1c] transition-colors hover:bg-white"
            >
              <PhoneCall className="h-3.5 w-3.5 text-[#7d3520]" /> Sună la 112 (dacă nu te poți deplasa singur sau starea se agravează)
            </a>
            {onCorrect && (
              <button
                type="button"
                onClick={onCorrect}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e3ddd0] bg-white/70 px-5 font-heading text-[12.5px] font-bold tracking-[-0.01em] text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {correctLabel}
              </button>
            )}
          </div>
        </div>

        <div className="mt-7 border-t border-[#e3ddd0] pt-4">
          <p className="text-[11.5px] leading-relaxed text-black/45">{COPY.explanation}</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-black/45">{COPY.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
