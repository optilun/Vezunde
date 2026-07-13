import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";

function PhaseStepper({ phases, phaseStep }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="hidden sm:flex items-center">
        {phases.map((label, i) => {
          const idx = i + 1;
          const done = idx < phaseStep;
          const current = idx === phaseStep;
          return (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                    done
                      ? "bg-foreground border-foreground text-background"
                      : current
                        ? "border-foreground text-foreground"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : idx}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${current ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </div>
              {idx < phases.length && <div className={`h-px flex-1 mx-3 ${done ? "bg-foreground" : "bg-border"}`} />}
            </React.Fragment>
          );
        })}
      </div>
      <div className="sm:hidden">
        <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-muted-foreground">
          <span className="truncate">{phases[phaseStep - 1]}</span>
          <span className="shrink-0">{phaseStep}/{phases.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full bg-foreground transition-all duration-500" style={{ width: `${(phaseStep / phases.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function WizardShell({
  step = 0,
  total = 0,
  phases = null,
  phaseStep = 0,
  title,
  subtitle = "",
  onBack = null,
  children,
}) {
  return (
    <div className="mx-auto min-h-[calc(100dvh-1px)] w-full max-w-xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:min-h-0 sm:px-6 sm:py-14">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-0">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            aria-label="Inapoi"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="hidden h-11 w-11 shrink-0 sm:block" />
        )}
        {phases && phaseStep ? (
          <PhaseStepper phases={phases} phaseStep={phaseStep} />
        ) : step && total ? (
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-muted-foreground sm:text-xs">
              <span>Pasul {step}</span>
              <span>{step}/{total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-500"
                style={{ width: `${(step / total) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <motion.div
        key={title}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mt-6 sm:mt-9"
      >
        <h1 className="font-heading text-[1.65rem] font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground sm:text-base">{subtitle}</p>}
        <div className="mt-6 min-w-0 sm:mt-7">{children}</div>
      </motion.div>
    </div>
  );
}
