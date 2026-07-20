import React from "react";
import { CheckCircle2, Clock3, SearchCheck, ShieldCheck } from "lucide-react";

const STATUS_ICON = {
  queued: Clock3,
  in_review: SearchCheck,
  completed: CheckCircle2,
  closed: CheckCircle2,
};

export default function PatientRecoveryStatusCard({ recovery }) {
  if (!recovery) return null;
  const Icon = STATUS_ICON[recovery.status] || Clock3;
  const complete = ["completed", "closed"].includes(recovery.status);

  return (
    <section data-component="PatientRecoveryStatusCard" className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-background text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Verificare VIASEE</p>
          <h2 className="mt-1 font-heading text-lg font-extrabold text-foreground">
            {recovery.status_label || "În așteptare pentru verificare"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {recovery.reason_label || "Căutarea automată nu a identificat momentan o opțiune potrivită."}
          </p>

          {complete && recovery.outcome_label && (
            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Rezultatul verificării</p>
              <p className="mt-1 text-xs font-bold text-foreground">{recovery.outcome_label}</p>
              {recovery.patient_update && (
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{recovery.patient_update}</p>
              )}
            </div>
          )}

          {!complete && (
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Cererea nu a fost trimisă automat furnizorilor. Statusul se actualizează aici după verificarea internă.
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 border-t border-primary/15 pt-4 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Verificarea nu promite identificarea unei locații, disponibilitatea serviciului sau un termen de răspuns.
          </p>
        </div>
      </div>
    </section>
  );
}
