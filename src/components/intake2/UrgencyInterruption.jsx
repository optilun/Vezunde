import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Droplets, PhoneCall, Search, ShieldAlert } from "lucide-react";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";

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
            VIASEE nu poate stabili cauza sau gravitatea simptomelor. Pentru situatiile de mai jos, nu astepta recomandari sau raspunsuri in platforma.
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
        <p><strong>Mergi imediat la UPU, camera de garda sau un serviciu de urgente oftalmologice.</strong></p>
        <p>Suna la 112 daca nu te poti deplasa in siguranta, vederea s-a pierdut brusc, exista un traumatism sever sau starea se agraveaza. Nu conduce.</p>
      </div>

      {chemical && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <Droplets className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <p className="text-xs leading-relaxed"><strong>Daca a ajuns o substanta chimica in ochi:</strong> clateste imediat cu apa curata cel putin 20 de minute, indeparteaza lentilele de contact daca se desprind usor si nu freca ochiul. Continua apoi spre urgenta.</p>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <a href="tel:112" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-700 px-5 text-sm font-extrabold text-white transition-opacity hover:opacity-90">
          <PhoneCall className="h-4 w-4" /> Suna la 112
        </a>
        {onCorrect && (
          <button type="button" onClick={onCorrect} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-5 text-sm font-bold text-red-950 hover:bg-red-100/60">
            <ArrowLeft className="h-4 w-4" /> Am selectat gresit. Corecteaza raspunsul
          </button>
        )}
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-red-900/70">Acest mesaj este informational si nu reprezinta diagnostic sau triaj medical.</p>
    </section>
  );
}
