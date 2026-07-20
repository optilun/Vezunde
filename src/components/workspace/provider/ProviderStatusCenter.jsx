import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDot, LockKeyhole, ShieldCheck } from "lucide-react";
import { buildProviderStatusCenter } from "../../../../shared/providerStatusCenter.js";

const STATE_STYLES = {
  active: "bg-emerald-500/10 text-emerald-700",
  conditional: "bg-primary/10 text-primary",
  limited: "bg-amber-500/10 text-amber-800",
  blocked: "bg-destructive/10 text-destructive",
};

function StateIcon({ state }) {
  if (state === "active") return <CheckCircle2 className="h-4 w-4" />;
  if (state === "blocked") return <LockKeyhole className="h-4 w-4" />;
  if (state === "limited") return <AlertTriangle className="h-4 w-4" />;
  return <CircleDot className="h-4 w-4" />;
}

export default function ProviderStatusCenter({ location, entitlement, counters }) {
  const [open, setOpen] = useState(false);
  const status = useMemo(() => buildProviderStatusCenter({ location, entitlement, counters }), [location, entitlement, counters]);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><ShieldCheck className="h-4 w-4" /> Status locatie</div>
          <h2 className="mt-1 font-heading text-lg font-extrabold text-foreground">{status.overall_label}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {status.profile.published ? "Profil public" : "Profil nepublicat"} · {status.profile.verified ? "verificat" : status.profile.controlled ? "revendicat" : "nerevendicat"} · plan {status.plan.code === "pro" ? "Pro" : "Free"}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary">
          {open ? "Ascunde detaliile" : "Vezi ce este activ"}<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="mt-5 border-t border-border pt-5">
          <div className="grid gap-3 md:grid-cols-2">
            {status.capabilities.map((item) => (
              <div key={item.key} className="rounded-xl border border-border bg-secondary/25 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATE_STYLES[item.state] || STATE_STYLES.conditional}`}><StateIcon state={item.state} />{item.state === "active" ? "Activ" : item.state === "conditional" ? "Conditionat" : item.state === "limited" ? "Limitat" : "Blocat"}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
          {status.blockers.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs font-bold text-foreground">Ce limiteaza accesul acum</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{status.blockers.map((item) => <li key={item}>• {item}</li>)}</ul>
            </div>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Statusul explica regulile existente. Nu modifica planul, eligibilitatea Top 3, acordul clientului sau starea profilului.</p>
        </div>
      )}
    </section>
  );
}
