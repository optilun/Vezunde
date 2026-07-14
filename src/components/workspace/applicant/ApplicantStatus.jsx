import React from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

export default function ApplicantStatus({ claim, statusCenter = {}, onNavigate }) {
  if (!claim) return null;
  const progress = statusCenter.preparation_progress || { percentage: 0, completed_count: 0, total_count: 0 };
  const nextAction = statusCenter.next_action || null;
  const needsAction = statusCenter.state === "needs_action";
  const preparationComplete = statusCenter.state === "preparation_complete";
  const StateIcon = needsAction ? AlertTriangle : preparationComplete ? CheckCircle2 : Clock3;
  const stateColor = needsAction ? "text-amber-700" : preparationComplete ? "text-green-700" : "text-blue-700";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Status solicitare</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vezi starea verificarii, progresul pregatirii si actiunea urmatoare.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <StateIcon className={`mt-0.5 h-5 w-5 shrink-0 ${stateColor}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">{statusCenter.headline || "Solicitarea este in verificare"}</h2>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                {CLAIM_STATUS_LABELS[claim.status] || claim.status}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {statusCenter.message || "Poti pregati informatiile profilului cat timp solicitarea este verificata."}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted-foreground">Pregatire profil</span>
          <span className="font-bold">{progress.completed_count}/{progress.total_count} pasi · {progress.percentage}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.max(0, Math.min(100, progress.percentage || 0))}%` }} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{statusCenter.action_required_count || 0} actiuni deschise</span>
          <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">{statusCenter.blocked_count || 0} pasi blocati pana la aprobare</span>
        </div>

        {claim.latest_admin_note && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <div className="text-xs font-bold uppercase tracking-wide">Completari solicitate de VIASEE</div>
            <p className="mt-1 text-xs leading-relaxed">{claim.latest_admin_note}</p>
          </div>
        )}

        {nextAction && (
          <button
            type="button"
            onClick={() => onNavigate?.(nextAction.navigation_key || "status")}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background"
          >
            {nextAction.label} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-bold">Datele solicitarii</h2>
        <dl className="mt-4 divide-y divide-border text-sm">
          <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0">
            <dt className="text-muted-foreground">Contact</dt>
            <dd className="text-right font-medium">{claim.contact_name || "-"}</dd>
          </div>
          <div className="flex items-start justify-between gap-4 py-2.5 last:pb-0">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all text-right font-medium">{claim.email || "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-secondary/30 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Informatiile pregatite raman private. Publicarea si administrarea completa se activeaza numai dupa confirmarea relatiei cu organizatia sau locatia.
          </p>
        </div>
      </section>
    </div>
  );
}
