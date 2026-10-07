import React, { useCallback } from "react";
import { RefreshCw, Search } from "lucide-react";

// Piese comune pentru listele „listă + detaliu” din panoul de admin (2026-10-07): același câmp de căutare,
// același buton de actualizare, același filtru cu listă și aceeași defilare spre detaliu pe telefon.

export function AdminSearchField({ value, onChange, placeholder, label }) {
  return (
    <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

export function AdminRefreshButton({ onClick, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
      Actualizează
    </button>
  );
}

export function AdminFilterSelect({ value, onChange, label, children }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </select>
    </label>
  );
}

// Pe ecrane înguste lista și detaliul sunt unul sub altul: după alegerea unui element, ducem ecranul
// la detaliu. Pe ecrane late (două coloane) nu mișcăm nimic.
export function useScrollToDetail(detailRef) {
  return useCallback(() => {
    if (typeof window === "undefined" || window.matchMedia?.("(min-width: 1280px)").matches) return;
    window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, [detailRef]);
}
