// Statusul locatiei, mutat in tabul "Cont" (2026-08-22).
//
// Continutul este acelasi: aceleasi capabilitati, aceleasi stari, aceiasi blocanti - vin
// neschimbate din buildProviderStatusCenter. S-a schimbat doar limbajul vizual, ca sa fie
// acelasi cu restul modulului: fundal crem cu textura, titluri font-heading, placi tonale
// din paleta de categorii in loc de culorile implicite Tailwind (emerald / amber /
// destructive), care nu apartineau niciunei alte parti din pagina.
import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDot, LockKeyhole, ShieldCheck } from "lucide-react";
import { buildProviderStatusCenter } from "../../../../shared/providerStatusCenter.js";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

// Aceleasi tonuri ca placile de categorii si contoarele din inbox.
const STATE_TONES = {
  active: { border: "#ccd2ba", bg: "#dfe3d2", label: "Activ" },
  conditional: { border: "#c6d3da", bg: "#dce5e9", label: "Conditionat" },
  limited: { border: "#dac69b", bg: "#eadcba", label: "Limitat" },
  blocked: { border: "#e1bda8", bg: "#efd5c5", label: "Blocat" },
};

function StateIcon({ state }) {
  if (state === "active") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (state === "blocked") return <LockKeyhole className="h-3.5 w-3.5" />;
  if (state === "limited") return <AlertTriangle className="h-3.5 w-3.5" />;
  return <CircleDot className="h-3.5 w-3.5" />;
}

export default function ProviderStatusCenter({ location, entitlement, counters, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const status = useMemo(() => buildProviderStatusCenter({ location, entitlement, counters }), [location, entitlement, counters]);

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] px-6 py-7">
      <span aria-hidden="true" className="absolute inset-0 opacity-25 mix-blend-multiply" style={GRAIN} />

      <div className="relative z-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">
              <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" /> Status locatie
            </p>
            <h2 className="mt-3 max-w-xl font-heading text-[1.8rem] font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-[2.1rem]">
              {status.overall_label}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {status.profile.published ? "Profil public" : "Profil nepublicat"} · {status.profile.verified ? "verificat" : status.profile.controlled ? "revendicat" : "nerevendicat"} · plan {status.plan.code === "pro" ? "Pro" : "Free"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45"
          >
            {open ? "Ascunde detaliile" : "Vezi ce este activ"}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Linia subtire cu jaloane, ca in restul modulului. */}
        <div className="relative mt-7 h-px bg-[#9a8668]/45">
          {[18, 52, 84].map((position) => (
            <span key={position} aria-hidden="true" className="absolute -top-1 h-[9px] w-[9px] -translate-x-1/2 rounded-full border border-[#8d7658] bg-[#f8f4ec]" style={{ left: `${position}%` }} />
          ))}
        </div>

        {open && (
          <div className="mt-7">
            <div className="grid gap-3 md:grid-cols-2">
              {status.capabilities.map((item) => {
                const tone = STATE_TONES[item.state] || STATE_TONES.conditional;
                return (
                  <div
                    key={item.key}
                    style={{ borderColor: tone.border, backgroundColor: tone.bg }}
                    className="relative overflow-hidden rounded-[1.4rem] border px-5 py-4 shadow-[0_10px_30px_rgba(34,30,24,0.028)]"
                  >
                    <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <p className="font-heading text-[15px] font-extrabold tracking-[-0.025em] text-[#1c1c1c]">{item.label}</p>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-black/65">
                        <StateIcon state={item.state} />{tone.label}
                      </span>
                    </div>
                    <p className="relative z-10 mt-2 text-[13px] leading-relaxed text-black/60">{item.detail}</p>
                  </div>
                );
              })}
            </div>

            {status.blockers.length > 0 && (
              <div
                style={{ borderColor: "#dac69b", backgroundColor: "#eadcba" }}
                className="relative mt-4 overflow-hidden rounded-[1.4rem] border px-5 py-4"
              >
                <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
                <p className="relative z-10 font-heading text-[14px] font-extrabold tracking-[-0.02em] text-[#1c1c1c]">Ce limiteaza accesul acum</p>
                <ul className="relative z-10 mt-2 space-y-1 text-[13px] leading-relaxed text-black/60">
                  {status.blockers.map((item) => <li key={item}>• {item}</li>)}
                </ul>
              </div>
            )}

            <p className="mt-5 text-[12px] leading-relaxed text-muted-foreground">
              Statusul explica regulile existente. Nu modifica planul, eligibilitatea Top 3, acordul clientului sau starea profilului.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
