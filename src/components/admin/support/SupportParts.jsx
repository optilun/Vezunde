import React, { useCallback } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { ORGANIZATION_ID_PREFIX } from "@/lib/adminGlobalSearch";
import { supportSourceLabel } from "@/lib/adminLabels";
import { adminHref } from "@/lib/adminNavConfig";

// Piese comune pentru Tichete suport și Feedback (2026-10-07): același câmp de căutare, același buton
// de actualizare, aceleași detalii de context și aceeași defilare spre detaliu pe telefon.

export function SupportSearchField({ value, onChange, placeholder, label }) {
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

export function RefreshButton({ onClick, busy }) {
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

export function FilterSelect({ value, onChange, label, children }) {
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

export function EmailLink({ email }) {
  if (!email) return <span className="text-muted-foreground">Email indisponibil</span>;
  return (
    <a href={`mailto:${email}`} className="break-all underline underline-offset-2 hover:text-foreground">
      {email}
    </a>
  );
}

// De unde a venit mesajul și ce poți deschide din el. Identificatorii tehnici stau într-o secțiune
// închisă: contează doar când cauți ceva în Base44.
export function SupportContext({ source, pagePath, organizationId, professionalProfileId, userId }) {
  const technical = [
    ["ID utilizator", userId],
    ["ID organizație", organizationId],
    ["ID profil profesional", professionalProfileId],
  ].filter(([, value]) => value);
  return (
    <div className="space-y-1.5 text-xs text-muted-foreground">
      <div>
        Trimis din <span className="font-semibold text-foreground">{supportSourceLabel(source)}</span>
        {pagePath && <span className="[overflow-wrap:anywhere]"> · {pagePath}</span>}
      </div>
      {organizationId && (
        <Link
          to={adminHref("profiluri", "", `${ORGANIZATION_ID_PREFIX}${organizationId}`)}
          className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2"
        >
          Deschide organizația <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
      {technical.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none font-semibold hover:text-foreground">Detalii tehnice</summary>
          <dl className="mt-1.5 space-y-0.5 break-all">
            {technical.map(([label, value]) => (
              <div key={label}><dt className="inline">{label}: </dt><dd className="inline font-mono text-[11px]">{value}</dd></div>
            ))}
          </dl>
        </details>
      )}
    </div>
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
