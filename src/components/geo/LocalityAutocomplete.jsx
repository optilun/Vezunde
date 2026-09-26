import React, { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Clock3, Loader2, LocateFixed, MapPin, Navigation, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { loadNationalDirectoryMap } from "@/lib/nationalDirectoryMap";
import {
  MAJOR_CITIES,
  formatDistance,
  formatLocationCount,
  localityCountsFromPoints,
  localityRowParts,
  nearbyLocalitiesFromPoints,
  pickLocalityForPlace,
  placeKey,
  prettyLocality,
  prettyPlaceName,
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
async function searchLocalities(query) {
  const key = query.trim().toLocaleLowerCase("ro");
  if (resultCache.has(key)) return resultCache.get(key);
  const res = await base44.functions.invoke("searchGeographicLocalities", { query: query.trim() });
  if (res.data?.error) throw new Error(res.data.error);
  const rows = res.data?.results || [];
  cacheResults(key, rows);
  return rows;
}

const GEO_MESSAGES = {
  denied: "Accesul la locație nu este permis. Alege localitatea din listă.",
  unavailable: "Poziția nu este disponibilă acum. Alege localitatea din listă.",
  imprecise: "Poziția este prea aproximativă. Alege localitatea din listă.",
  empty: "Nu am găsit locații în apropiere. Alege localitatea din listă.",
};

// Canonical locality selector backed by searchGeographicLocalities (Module 3F.2).
// `guided` (pe /cauta): la deschidere arata „Folosește locația mea”, localitatile recente si
// orasele mari, cu numele scrise cu diacritice. `showCounts` adauga numarul de locatii pe oras
// (doar cand nu e ales un serviciu: numarul e al tuturor locatiilor, nu al celor potrivite).
// Celelalte formulare (onboarding, admin) raman ca inainte.
const LocalityAutocomplete = forwardRef(function LocalityAutocomplete({
  value,
  onSelect,
  placeholder = "Caută localitatea...",
  className = "",
  variant = "default",
  guided = false,
  showCounts = false,
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
  const [mapPoints, setMapPoints] = useState(null);
  const [geo, setGeo] = useState({ status: "idle", nearby: [] });
  const [resolving, setResolving] = useState("");
  const inputRef = useRef(null);
  const alive = useRef(true);
  const listId = useId();
  const optionId = (index) => `${listId}-option-${index}`;

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    if (q.length < 2) { setResults([]); setStatus("idle"); return undefined; }
    const key = q.toLocaleLowerCase("ro");
    if (resultCache.has(key)) { setResults(resultCache.get(key)); setStatus("ready"); return undefined; }
    setResults([]);
    setStatus("loading");
    const timer = window.setTimeout(() => {
      searchLocalities(q)
        .then((rows) => { if (reqId.current === id) { setResults(rows); setStatus("ready"); } })
        .catch(() => { if (reqId.current === id) { setResults([]); setStatus("error"); } });
    }, 200);
    return () => { window.clearTimeout(timer); reqId.current += 1; };
  }, [query, retry]);

  // Harta nationala e aceeasi ca pe /cauta (tinuta cateva minute in pagina), deci de obicei e deja
  // incarcata. O cerem doar cand e nevoie: numere pe orase sau „Folosește locația mea”.
  const ensureMapPoints = useCallback(async () => {
    const data = await loadNationalDirectoryMap();
    const points = Array.isArray(data?.results) ? data.results : [];
    if (alive.current) setMapPoints(points);
    return points;
  }, []);
  useEffect(() => {
    if (guided && showCounts && open && mapPoints === null) ensureMapPoints().catch(() => {});
  }, [guided, showCounts, open, mapPoints, ensureMapPoints]);
  const counts = useMemo(() => (mapPoints ? localityCountsFromPoints(mapPoints) : null), [mapPoints]);

  const requestLocation = () => {
    if (!navigator.geolocation) { setGeo({ status: "unavailable", nearby: [] }); return; }
    setGeo({ status: "loading", nearby: [] });
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (!alive.current) return;
      if (position.coords.accuracy > 5000) { setGeo({ status: "imprecise", nearby: [] }); return; }
      try {
        const points = await ensureMapPoints();
        const nearby = nearbyLocalitiesFromPoints(points, { lat: position.coords.latitude, lng: position.coords.longitude }, 3);
        if (!alive.current) return;
        setGeo({ status: nearby.length ? "ready" : "empty", nearby });
        setOpen(true);
        inputRef.current?.focus();
      } catch {
        if (alive.current) setGeo({ status: "unavailable", nearby: [] });
      }
    }, (error) => {
      if (alive.current) setGeo({ status: error.code === 1 ? "denied" : "unavailable", nearby: [] });
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  const typing = query.trim().length >= 2;
  const quickPicks = useMemo(() => {
    if (!guided) return [];
    const nearbyKeys = new Set(geo.nearby.map((place) => place.key));
    const recentCodes = new Set(recent.map((item) => item.siruta_code));
    const notNearby = (locality) => !nearbyKeys.has(placeKey(locality.name, locality.county_name));
    return [
      ...(geo.status === "ready" ? [] : [{ section: "geo" }]),
      ...geo.nearby.map((place) => ({ section: "nearby", place })),
      ...recent.map(prettyLocality).filter(notNearby).map((locality) => ({ locality, section: "recent" })),
      ...MAJOR_CITIES.filter((city) => !recentCodes.has(city.siruta_code)).filter(notNearby).map((locality) => ({ locality, section: "city" })),
    ];
  }, [guided, recent, geo]);
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

  // Localitatea din harta devine localitatea oficiala (cod SIRUTA) prin aceeasi cautare ca atunci
  // cand scrii numele. Daca nu o gasim sigur, lasam numele scris ca pacientul sa aleaga.
  const chooseNearby = async (place) => {
    setResolving(place.key);
    try {
      const locality = pickLocalityForPlace(await searchLocalities(place.city), place.city, place.county);
      if (!alive.current) return;
      if (locality) choose(locality);
      else { setQuery(place.city); setOpen(true); inputRef.current?.focus(); }
    } catch {
      if (alive.current) { setQuery(place.city); setOpen(true); }
    } finally {
      if (alive.current) setResolving("");
    }
  };

  const activate = (option) => {
    if (option.section === "geo") requestLocation();
    else if (option.section === "nearby") chooseNearby(option.place);
    else choose(option.locality);
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
      activate(options[active]);
    }
  };

  const rowClass = (index) => `flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${index === active ? "bg-secondary" : ""}`;
  const optionProps = (option, index) => ({
    id: optionId(index),
    role: "option",
    "aria-selected": index === active,
    onMouseDown: (event) => event.preventDefault(),
    onMouseEnter: () => setActive(index),
    onClick: () => activate(option),
    className: rowClass(index),
  });

  const renderOption = (option, index) => {
    if (option.section === "geo") {
      const loading = geo.status === "loading";
      return (
        <div key="geo" {...optionProps(option, index)}>
          {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#4f6080]" aria-hidden="true" /> : <LocateFixed className="h-4 w-4 shrink-0 text-[#4f6080]" aria-hidden="true" />}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[#4f6080]">{loading ? "Se caută poziția..." : "Folosește locația mea"}</span>
            <span className="block text-xs text-muted-foreground">Găsim localitățile apropiate. Poziția nu pleacă de pe dispozitivul tău.</span>
          </span>
        </div>
      );
    }
    if (option.section === "nearby") {
      const { place } = option;
      const details = [formatDistance(place.distanceKm), showCounts ? formatLocationCount(place.count) : ""].filter(Boolean).join(" · ");
      return (
        <div key={`nearby-${place.key}`} {...optionProps(option, index)}>
          {resolving === place.key ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#4f6080]" aria-hidden="true" /> : <Navigation className="h-4 w-4 shrink-0 text-[#4f6080]" aria-hidden="true" />}
          <span className="min-w-0 flex-1 truncate font-medium">{prettyPlaceName(place.city)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{details}</span>
        </div>
      );
    }
    const { locality, section } = option;
    const parts = guided ? localityRowParts(locality) : { main: locality.display_label, secondary: locality.county_name && !locality.display_label.includes(locality.county_name) ? locality.county_name : "" };
    const count = guided && showCounts && counts && section !== "result" ? counts.get(placeKey(locality.name, locality.county_name)) : 0;
    const Icon = section === "recent" ? Clock3 : MapPin;
    return (
      <div key={`${section}-${locality.siruta_code}`} {...optionProps(option, index)}>
        {guided && <Icon className="h-4 w-4 shrink-0 text-[#4f6080]" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate font-medium">{parts.main}</span>
        {(count || parts.secondary) && <span className="shrink-0 text-xs text-muted-foreground">{count ? formatLocationCount(count) : parts.secondary}</span>}
      </div>
    );
  };

  const sectionTitle = (text) => (
    <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" aria-hidden="true">{text}</p>
  );
  const renderSection = (section, title) => {
    if (!options.some((option) => option.section === section)) return null;
    return <>
      {title && sectionTitle(title)}
      {options.map((option, index) => (option.section === section ? renderOption(option, index) : null))}
    </>;
  };

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
        hidden={!listOpen}
        className={`absolute z-40 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg ${guided ? "left-0 w-[min(22rem,calc(100vw-2rem))] md:left-auto md:right-0" : "w-full"}`}
      >
        <div
          id={listId}
          role="listbox"
          aria-label={typing ? "Localități găsite" : "Localități sugerate"}
          className="max-h-[min(24rem,58dvh)] overflow-y-auto py-1"
        >
          {listOpen && (typing ? options.map(renderOption) : <>
            {renderSection("geo")}
            {GEO_MESSAGES[geo.status] && <p aria-hidden="true" className="px-4 pb-2 text-xs leading-relaxed text-[#8a4b2a]">{GEO_MESSAGES[geo.status]}</p>}
            {renderSection("nearby", "Lângă tine")}
            {renderSection("recent", "Căutate recent")}
            {renderSection("city", "Orașe mari")}
            <p className="px-4 pb-2 pt-1 text-xs text-muted-foreground">Sau scrie numele oricărei localități.</p>
          </>)}
        </div>
      </div>
      {guided && <p role="status" className="sr-only">{GEO_MESSAGES[geo.status] || (geo.status === "ready" ? `Localități apropiate: ${geo.nearby.map((place) => prettyPlaceName(place.city)).join(", ")}` : "")}</p>}
    </div>
  );
});

export default LocalityAutocomplete;
