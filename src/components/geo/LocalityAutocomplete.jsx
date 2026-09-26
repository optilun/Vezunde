import React, { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Clock3, MapPin, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  MAJOR_CITIES,
  localityRowParts,
  prettyLocality,
  readRecentLocalities,
  rememberLocality,
} from "@/lib/localityQuickPicks";

// Raspunsurile deja primite raman in memorie cat timp e deschisa pagina: stergerea unei litere sau
// revenirea la acelasi oras nu mai asteapta serverul.
const resultCache = new Map();
const CACHE_LIMIT = 60;
function cacheResults(key, results) {
  if (resultCache.size >= CACHE_LIMIT) resultCache.delete(resultCache.keys().next().value);
  resultCache.set(key, results);
}

// Canonical locality selector backed by searchGeographicLocalities (Module 3F.2).
// `guided` (pe /cauta): la deschidere arata localitatile recente si orasele mari, iar numele apar
// cu diacritice. Celelalte formulare (onboarding, admin) raman ca inainte.
const LocalityAutocomplete = forwardRef(function LocalityAutocomplete({
  value,
  onSelect,
  placeholder = "Caută localitatea...",
  className = "",
  variant = "default",
  guided = false,
  inputId,
}, ref) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const reqId = useRef(0);
  const [status, setStatus] = useState("idle");
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(() => (guided ? readRecentLocalities() : []));
  const inputRef = useRef(null);
  const listId = useId();
  const optionId = (index) => `${listId}-option-${index}`;

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    if (q.length < 2) { setResults([]); setStatus("idle"); return undefined; }
    const key = q.toLocaleLowerCase("ro");
    if (resultCache.has(key)) { setResults(resultCache.get(key)); setStatus("ready"); return undefined; }
    setResults([]);
    setStatus("loading");

    const timer = window.setTimeout(() => {
      base44.functions
        .invoke("searchGeographicLocalities", { query: q })
        .then((res) => {
          if (res.data?.error) throw new Error(res.data.error);
          const rows = res.data?.results || [];
          cacheResults(key, rows);
          if (reqId.current === id) { setResults(rows); setStatus("ready"); }
        })
        .catch(() => {
          if (reqId.current === id) { setResults([]); setStatus("error"); }
        });
    }, 200);
    return () => { window.clearTimeout(timer); reqId.current += 1; };
  }, [query, retry]);

  const typing = query.trim().length >= 2;
  const quickPicks = useMemo(() => {
    if (!guided) return [];
    const recentCodes = new Set(recent.map((item) => item.siruta_code));
    return [
      ...recent.map((item) => ({ locality: prettyLocality(item), section: "recent" })),
      ...MAJOR_CITIES.filter((city) => !recentCodes.has(city.siruta_code)).map((locality) => ({ locality, section: "city" })),
    ];
  }, [guided, recent]);
  const options = typing ? results.map((locality) => ({ locality, section: "result" })) : quickPicks;

  useEffect(() => { setActive(options.length > 0 ? 0 : -1); }, [options.length, typing, results]);

  const choose = (locality) => {
    const chosen = guided ? prettyLocality(locality) : locality;
    if (guided) { rememberLocality(chosen); setRecent(readRecentLocalities()); }
    setQuery("");
    setResults([]);
    setOpen(false);
    onSelect(chosen);
  };

  if (value) {
    const shown = guided ? prettyLocality(value) : value;
    return (
      <div
        className={`flex min-h-12 items-center justify-between ${variant === "compact" ? "rounded-full border border-transparent" : "rounded-xl border border-border"} bg-card pl-4 pr-0.5 text-sm ${className}`}
      >
        <span className="min-w-0 truncate font-medium">
          {shown.display_label || shown.name}
        </span>
        <button
          type="button"
          onClick={() => { onSelect(null); if (guided) window.requestAnimationFrame(() => inputRef.current?.focus()); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label="Șterge localitatea"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const listOpen = open && options.length > 0 && (typing || guided);
  const onKeyDown = (event) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + options.length) % options.length);
      return;
    }
    if (event.key === "Enter" && listOpen && active >= 0 && options[active]) {
      event.preventDefault();
      choose(options[active].locality);
    }
  };

  const renderOption = ({ locality, section }, index) => {
    const parts = guided ? localityRowParts(locality) : { main: locality.display_label, secondary: locality.county_name && !locality.display_label.includes(locality.county_name) ? locality.county_name : "" };
    const Icon = section === "recent" ? Clock3 : MapPin;
    return (
      <div
        key={`${section}-${locality.siruta_code}`}
        id={optionId(index)}
        role="option"
        aria-selected={index === active}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActive(index)}
        onClick={() => choose(locality)}
        className={`flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${index === active ? "bg-secondary" : ""}`}
      >
        {guided && <Icon className="h-4 w-4 shrink-0 text-[#4f6080]" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate font-medium">{parts.main}</span>
        {parts.secondary && <span className="shrink-0 text-xs text-muted-foreground">{parts.secondary}</span>}
      </div>
    );
  };

  const sectionTitle = (text) => (
    <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" aria-hidden="true">{text}</p>
  );

  return (
    <div className={`relative ${className}`} onFocus={() => setOpen(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input
        ref={inputRef}
        id={inputId}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
        onClick={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        enterKeyHint="search"
        className={`min-h-12 w-full ${variant === "compact" ? "rounded-full border border-transparent" : "rounded-xl border border-border"} bg-card px-4 py-2.5 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm`}
      />
      {open && typing && (status === "loading" || status === "error" || (status === "ready" && results.length === 0)) && <div className="absolute z-40 mt-1 w-full rounded-xl border border-border bg-card p-4 text-sm shadow-lg">
        <p role="status">{status === "loading" ? "Se caută localități..." : status === "error" ? "Nu am putut încărca localitățile." : "Nu am găsit localitatea. Verifică denumirea."}</p>
        {status === "error" && <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 min-h-11 rounded-full border border-border px-4">Reîncearcă</button>}
      </div>}
      <div
        id={listId}
        role="listbox"
        aria-label={typing ? "Localități găsite" : "Localități sugerate"}
        hidden={!listOpen}
        className={`absolute z-40 mt-1 max-h-[min(22rem,55dvh)] overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-lg ${guided ? "left-0 w-[min(22rem,calc(100vw-2rem))] md:left-auto md:right-0" : "w-full"}`}
      >
        {listOpen && (typing ? options.map(renderOption) : <>
          {options.some((option) => option.section === "recent") && sectionTitle("Căutate recent")}
          {options.map((option, index) => option.section === "recent" ? renderOption(option, index) : null)}
          {sectionTitle("Orașe mari")}
          {options.map((option, index) => option.section === "city" ? renderOption(option, index) : null)}
          <p className="px-4 pb-2 pt-1 text-xs text-muted-foreground">Sau scrie numele oricărei localități.</p>
        </>)}
      </div>
    </div>
  );
});

export default LocalityAutocomplete;
