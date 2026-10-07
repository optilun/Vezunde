import React, { useRef } from "react";
import { cn } from "@/lib/utils";

// Taburile comune ale panoului de admin (2026-10-07). Un singur stil (înainte erau cel puțin 5),
// cu roluri ARIA și săgeți stânga/dreapta, plus contor opțional ("3") pentru ce așteaptă.
//   tabs: [{ key, label, count? }]   count = număr | null/undefined (nu se arată nimic)
export default function AdminTabs({ tabs, value, onChange, label = "Secțiuni", className = "" }) {
  const refs = useRef({});

  const move = (event, index) => {
    const last = tabs.length - 1;
    let next = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    const target = tabs[next];
    onChange(target.key);
    refs.current[target.key]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {tabs.map((tab, index) => {
        const selected = tab.key === value;
        const hasCount = Number.isFinite(tab.count) && tab.count > 0;
        return (
          <button
            key={tab.key}
            ref={(node) => { refs.current[tab.key] = node; }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-secondary",
            )}
          >
            {tab.label}
            {hasCount && (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                  selected ? "bg-background/25 text-background" : "bg-foreground text-background",
                )}
              >
                {tab.count}
                <span className="sr-only"> de rezolvat</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
