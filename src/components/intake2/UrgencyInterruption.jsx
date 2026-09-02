import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Droplets, PhoneCall, ShieldAlert } from "lucide-react";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";
import { APPROVED_PATIENT_SAFETY_COPY } from "../../../shared/patientGuidanceQuestionCatalog.js";

// 2026-09-02: textul de urgenta vine acum din APPROVED_PATIENT_SAFETY_COPY, nu mai e copiat
// aici. Era duplicat, iar duplicatul chiar divergease: ecranul spunea "cat mai curand" acolo
// unde textul aprobat spune "imediat". Pe cel mai critic ecran al aplicatiei, o copie care
// se poate abate tacut de la formularea aprobata medical nu e acceptabila.
const COPY = APPROVED_PATIENT_SAFETY_COPY;

// 2026-09-02: ecranul era in registru strain de VIASEE - rosu Tailwind implicit, buton
// stacojiu, tipografie de alerta generica. Arata ca o eroare de sistem, nu ca platforma pe
// care pacientul tocmai o folosea. Acum foloseste acelasi vocabular ca restul aplicatiei
// (prezentarea generala a organizatiei, modulul de leaduri): hartie crem, textura, supratitlu
// mono, titlu Manrope stramt, placi tonale din paleta de categorii, pastile.
//
// Urgenta NU se pierde: se citeste din ierarhie, nu din stridenta. Banda caramizie din
// marginea de sus si sigiliul spun imediat ca panoul asta nu e ca celelalte, iar instructiunea
// aprobata e cel mai mare bloc de text de pe ecran.
//
// Ordinea impusa de docs/patient-emergency-guidance-policy.md ramane neschimbata: destinatia
// spitaliceasca prima, 112 dupa ea, conditionat si niciodata ca actiune principala. Butonul
// negru (primarul VIASEE) duce la cabinete; 112 ramane pastila secundara, ca inainte.
const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

// Caramiziul din paleta de categorii, folosit si pe placile din workspace. Suficient de cald
// ca sa ramana VIASEE, suficient de saturat ca sa nu fie citit ca o nota neutra.
const ALERT_TONE = { borderColor: "#e1bda8", backgroundColor: "#efd5c5" };
const CHEMICAL_TONE = { borderColor: "#c6d3da", backgroundColor: "#dce5e9" };

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
      className="relative overflow-hidden rounded-[1.75rem] border border-[#d9c3b4] bg-[#fdfbf6] px-5 py-6 shadow-[0_18px_48px_rgba(34,30,24,0.05)] sm:px-7 sm:py-7"
    >
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={GRAIN} />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: "#b4573a" }} />

      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <span
            style={ALERT_TONE}
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[#7d3520]"
          >
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <ShieldAlert className="relative z-10 h-5 w-5" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[#8a412b]">{COPY.eyebrow}</p>
            <h2 className="mt-3 max-w-2xl font-heading text-[1.6rem] font-extrabold leading-[1.02] tracking-[-0.045em] text-[#1c1c1c] sm:text-[2rem]">
              {blocking ? COPY.blocking_title : COPY.advisory_title}
            </h2>
          </div>
        </div>

        <p className="mt-5 max-w-2xl text-[13.5px] leading-relaxed text-black/60">
          {COPY.explanation}
        </p>

        {labels.length > 0 && (
          <div style={ALERT_TONE} className="relative mt-5 overflow-hidden rounded-[1.4rem] border px-5 py-4">
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <p className="relative z-10 font-mono text-[9.5px] uppercase tracking-[0.16em] text-black/55">Semnal identificat</p>
            <ul className="relative z-10 mt-2.5 space-y-2">
              {labels.map((label) => (
                <li key={label} className="flex items-start gap-2 font-heading text-[13.5px] font-bold leading-snug tracking-[-0.015em] text-[#1c1c1c]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7d3520]" /> {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructiunea aprobata: cel mai mare bloc de text de pe ecran. */}
        <p className="mt-6 max-w-2xl font-heading text-[17px] font-extrabold leading-snug tracking-[-0.025em] text-[#1c1c1c] sm:text-[18.5px]">
          {COPY.primary_instruction}
        </p>
        <div className="mt-3 max-w-2xl space-y-2 text-[13.5px] leading-relaxed text-black/60">
          <p>Nu conduce singur dacă vederea îți este afectată — roagă pe cineva să te ducă.</p>
          <p>VIASEE nu poate confirma care locații au gardă activă acum — sună înainte, sau mergi direct la cea mai apropiată unitate de urgență.</p>
        </div>

        {chemical && (
          <div style={CHEMICAL_TONE} className="relative mt-5 flex items-start gap-3 overflow-hidden rounded-[1.4rem] border px-5 py-4">
            <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            <Droplets className="relative z-10 mt-0.5 h-4 w-4 shrink-0 text-[#3d5a68]" />
            <p className="relative z-10 text-[13px] leading-relaxed text-black/70">{COPY.chemical_instruction}</p>
          </div>
        )}

        <div className="mt-6 h-px bg-[#9a8668]/35" />

        <div className="mt-6 flex flex-col gap-2.5">
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

        <p className="mt-6 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-black/40">{COPY.disclaimer}</p>
      </div>
    </section>
  );
}
