import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Info } from "lucide-react";

export default function DecisionConfidencePanel({ confidence }) {
  const [expanded, setExpanded] = useState(false);
  if (!confidence?.label) return null;

  const filled = Math.max(1, Math.min(Number(confidence.filled_segments) || 1, 3));
  const evidence = Array.isArray(confidence.evidence) ? confidence.evidence : [];
  const limitations = Array.isArray(confidence.limitations) ? confidence.limitations : [];

  return (
    <section className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-3.5" aria-label="Increderea in potrivire">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-foreground">{confidence.label}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{confidence.summary}</p>
        </div>
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5" aria-label={`${filled} din 3 niveluri de dovezi confirmate`}>
        {[1, 2, 3].map((segment) => (
          <span
            key={segment}
            className={`h-1.5 rounded-full ${segment <= filled ? "bg-primary" : "bg-border"}`}
            aria-hidden="true"
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 text-[11px] font-bold text-foreground underline underline-offset-4"
        aria-expanded={expanded}
      >
        {expanded ? "Ascunde explicatia" : "Vezi de ce"}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-3 border-t border-primary/10 pt-3">
          {evidence.length > 0 && (
            <ul className="space-y-1.5">
              {evidence.map((item) => (
                <li key={item.code || item.label} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          )}
          {limitations.length > 0 && (
            <div className="rounded-xl bg-background/80 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Ce nu este confirmat</p>
              <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                {limitations.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          )}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Nivelul se bazeaza numai pe informatiile confirmate din profil si din cerere. Plata nu influenteaza acest indicator sau ordinea rezultatelor.
          </p>
        </div>
      )}
    </section>
  );
}
