import React from "react";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

export default function WizardShell({ step, total, title, subtitle, onBack, children }) {
  return (
    <div className="max-w-xl mx-auto px-5 py-10 sm:py-14">
      <div className="flex items-center gap-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            aria-label="Inapoi"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9 h-9" />
        )}
        {step && total && (
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1.5">Pasul {step} din {total}</div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(step / total) * 100}%`, backgroundColor: "#171717" }}
              />
            </div>
          </div>
        )}
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