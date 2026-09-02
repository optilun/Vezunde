import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check } from "lucide-react";

const STEPS = [
  "Analizăm ce cauți",
  "Verificăm opțiunile disponibile",
  "Organizam rezultatele",
];

// Module: calm progress interface shown while the existing matching request is
// in flight (phase === "submitting"). Purely visual — does not create any
// patient request, message or chat, and does not delay the real request.
export default function SearchingTransition() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (active >= STEPS.length - 1) return;
    const t = setTimeout(() => setActive((s) => s + 1), 900);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className="py-8">
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
        Cautam optiuni potrivite
      </h2>
      <div className="mt-6 space-y-3">
        {STEPS.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="flex items-center justify-center w-5 h-5 rounded-full border border-border shrink-0">
                <AnimatePresence mode="wait">
                  {done ? (
                    <motion.span key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <Check className="w-3 h-3 text-primary" />
                    </motion.span>
                  ) : current ? (
                    <Loader2 className="w-3 h-3 text-muted-foreground animate-spin" />
                  ) : null}
                </AnimatePresence>
              </span>
              <span className={`text-sm ${done || current ? "text-foreground" : "text-muted-foreground/60"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}