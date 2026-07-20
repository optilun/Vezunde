import React, { useState } from "react";
import { CheckCircle2, CircleOff, Clock3, Loader2, ShieldCheck } from "lucide-react";

const PRESENTATION = {
  active: { icon: Clock3, tone: "border-primary/20 bg-primary/5 text-primary" },
  resolved: { icon: CheckCircle2, tone: "border-emerald-500/20 bg-emerald-500/5 text-emerald-700" },
  closed: { icon: CircleOff, tone: "border-border bg-secondary/40 text-foreground" },
  expired: { icon: CircleOff, tone: "border-border bg-secondary/40 text-muted-foreground" },
};

export default function PatientRequestLifecyclePanel({ lifecycle, request, updating = false, onAction }) {
  const [confirmAction, setConfirmAction] = useState("");
  const state = lifecycle?.state || "active";
  const presentation = PRESENTATION[state] || PRESENTATION.active;
  const Icon = presentation.icon;
  const terminal = lifecycle?.terminal === true;

  const submit = async (action) => {
    if (confirmAction !== action) {
      setConfirmAction(action);
      return;
    }
    await onAction?.(action);
    setConfirmAction("");
  };

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${presentation.tone}`}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Starea cererii</p>
            <h4 className="mt-1 text-base font-extrabold text-foreground">{lifecycle?.state_label || "Activa"}</h4>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Etapa curenta: <strong className="text-foreground">{lifecycle?.stage_label || "Trimisa"}</strong>
            </p>
            {request?.expires_at && state === "active" && (
              <p className="mt-1 text-[11px] text-muted-foreground">Cererea expira automat la {new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(request.expires_at))}.</p>
            )}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-background px-3 py-1.5 text-[11px] font-bold text-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Acces controlat
        </span>
      </div>

      {terminal ? (
        <p className="mt-4 rounded-xl border border-border bg-secondary/35 p-3 text-xs leading-relaxed text-muted-foreground">
          Cererea nu mai primeste raspunsuri noi. Conversatiile sunt inchise, iar accesul la telefon a fost retras. Istoricul ramane vizibil.
        </p>
      ) : (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Marcheaza cererea ca rezolvata cand ai primit ajutorul necesar. Foloseste inchiderea cand nu mai doresti continuarea cererii.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={updating}
              onClick={() => void submit("resolve")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background hover:opacity-90 disabled:opacity-60"
            >
              {updating && confirmAction === "resolve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {confirmAction === "resolve" ? "Confirma rezolvarea" : "Cererea a fost rezolvata"}
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => void submit("close")}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"
            >
              {updating && confirmAction === "close" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleOff className="h-3.5 w-3.5" />}
              {confirmAction === "close" ? "Confirma inchiderea" : "Inchide cererea"}
            </button>
            {confirmAction && !updating && (
              <button type="button" onClick={() => setConfirmAction("")} className="min-h-10 px-3 text-xs font-bold text-muted-foreground hover:text-foreground">Anuleaza</button>
            )}
          </div>
          {confirmAction && (
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Confirmarea inchide toate conversatiile si retrage accesul acordat la telefon.</p>
          )}
        </div>
      )}
    </div>
  );
}
