import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";

// Horizontal desktop stepper + compact mobile progress. Pass `phases` (array of
// short labels) and 1-based `phaseStep` to get the named dot-stepper; omit them
// to fall back to the legacy numeric bar (used for long internal sub-flows).
function PhaseStepper({ phases, phaseStep }) {
  return (
    <div className="flex-1">
      {/* Desktop: horizontal numbered stepper with labels */}
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
      {/* Mobile: compact progress indicator */}
      <div className="sm:hidden">
        <div className="text-xs text-muted-foreground mb-1.5">Pasul {phaseStep} din {phases.length} · {phases[phaseStep - 1]}</div>
        <div className="h-1 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(phaseStep / phases.length) * 100}%`, backgroundColor: "#171717" }} />
        </div>
      </div>
    </div>
  );
}

export default function WizardShell({ step, total, phases, phaseStep, title, subtitle, onBack, children }) {
  return (
    <div className="max-w-xl mx-auto px-5 py-10 sm:py-14">
      <div className="flex items-center gap-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors shrink-0"
            aria-label="Inapoi"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9 h-9 shrink-0" />
        )}
        {phases && phaseStep ? (
          <PhaseStepper phases={phases} phaseStep={phaseStep} />
        ) : step && total ? (
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1.5">Pasul {step} din {total}</div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(step / total) * 100}%`, backgroundColor: "#171717" }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <motion.div
        key={title}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mt-9"
      >
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-muted-foreground text-sm sm:text-base">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </motion.div>
    </div>
  );
}