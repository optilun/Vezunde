import React from "react";
import { AlertTriangle, Check, Pencil, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PATIENT_SAFETY_FLAG_PRESENTATION } from "@/lib/patientSafety";

export default function PatientIntentConfirmation({
  proposal,
  intentLabel,
  onConfirm,
  onCorrect,
}) {
  const requiresManualChoice = proposal?.status !== "confirm";
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

  return (
    <div className="py-2 sm:py-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Interpretare asistată
      </div>

      <h2 className="mt-5 font-heading text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {requiresManualChoice
          ? "Mai avem nevoie de o clarificare."
          : `Am înțeles că ai nevoie de ${String(intentLabel || "acest serviciu").toLowerCase()}.`}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {requiresManualChoice
          ? "Alege categoria potrivită pentru a continua cu întrebările aprobate."
          : "Confirmă interpretarea înainte să continuăm. AI-ul nu alege furnizorii și nu stabilește ordinea rezultatelor."}
      </p>

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

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        {!requiresManualChoice && (
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Check className="h-4 w-4" />
            Da, continuă
          </button>
        )}
        <button
          type="button"
          onClick={onCorrect}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <Pencil className="h-4 w-4" />
          {requiresManualChoice ? "Aleg categoria" : "Aleg altă nevoie"}
        </button>
      </div>
    </div>
  );
}
