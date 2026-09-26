import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search as SearchIcon, X } from "lucide-react";
import {
  highlightParts,
  popularServiceSuggestions,
  rankServiceSuggestions,
  serviceGroupShort,
} from "@/lib/serviceAutocomplete";

// Caseta „Ce serviciu cauți?” de pe /cauta.
// - goala: cele mai cautate nevoi, cu o explicatie scurta;
// - de la prima litera: servicii potrivite, cu partea scrisa evidentiata;
// - sageti, Enter si Escape din tastatura (combobox ARIA).
// Alegerea unei sugestii trimite aceeasi cheie de serviciu ca inainte; textul liber ramane posibil.
export default function ServiceSearchField({ query, service, onQueryChange, onChoose, onClear, inputId = "directory-search" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef(null);
  const typed = query.trim();
  const showPopular = !typed || Boolean(service);

  const options = useMemo(
    () => (showPopular ? popularServiceSuggestions() : rankServiceSuggestions(typed, { limit: 8 })),
    [showPopular, typed],
  );
  useEffect(() => { setActive(!showPopular && options.length > 0 ? 0 : -1); }, [options, showPopular]);

  const choose = (option) => {
    setOpen(false);
    onChoose(option);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      if (!options.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current < 0 ? (step > 0 ? 0 : options.length - 1) : (current + step + options.length) % options.length));
      return;
    }
    if (event.key === "Enter" && open && active >= 0 && options[active]) {
      event.preventDefault();
      choose(options[active]);
    }
  };

  const listOpen = open && (options.length > 0 || Boolean(typed && !service));
  const optionId = (index) => `${listId}-option-${index}`;

  return (
    <div
      className="relative"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    >
      <label htmlFor={inputId} className="sr-only">Ce serviciu cauți?</label>
      <SearchIcon className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-[#4f6080]" aria-hidden="true" />
      <input
        ref={inputRef}
        id={inputId}
        value={query}
        onChange={(event) => { onQueryChange(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Ce serviciu cauți?"
        autoComplete="off"
        enterKeyHint="search"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active >= 0 ? optionId(active) : undefined}
        className="min-h-12 w-full rounded-full border border-transparent bg-card py-2.5 pl-11 pr-12 text-base outline-none transition-colors focus:border-primary/50 sm:text-sm"
      />
      {(query || service) && (
        <button
          type="button"
          aria-label="Șterge căutarea"
          onClick={() => { onClear(); setOpen(true); inputRef.current?.focus(); }}
          className="absolute right-1 top-0.5 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <div
        hidden={!listOpen}
        className="absolute left-0 z-40 mt-2 w-full min-w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        {showPopular && (
          <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" aria-hidden="true">
            Căutate des
          </p>
        )}
        <div
          id={listId}
          role="listbox"
          aria-label={showPopular ? "Servicii căutate des" : "Servicii potrivite"}
          className="max-h-[min(22rem,50dvh)] overflow-y-auto py-1"
        >
          {listOpen && options.map((option, index) => (
            <div
              key={option.service_key}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
              className={`flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors ${index === active ? "bg-secondary" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-foreground">
                  {showPopular ? option.label : highlightParts(option.label, typed).map((part, partIndex) => (
                    part.match ? <strong key={partIndex} className="font-semibold">{part.text}</strong> : <span key={partIndex}>{part.text}</span>
                  ))}
                </span>
                {option.hint && <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>}
              </span>
              {!showPopular && serviceGroupShort(option.group) && (
                <span className="shrink-0 rounded-full bg-[#eff1f5] px-2 py-0.5 text-[11px] font-medium text-[#4f6080]">
                  {serviceGroupShort(option.group)}
                </span>
              )}
            </div>
          ))}
        </div>
        {!showPopular && options.length === 0 && (
          <div className="px-4 pb-3 text-sm" role="status">
            <p className="font-medium">Nu am găsit un serviciu cu acest nume.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Poți căuta și așa, cu textul scris, sau poți descrie situația și te ajutăm să alegi.
            </p>
          </div>
        )}
        <Link
          to="/cerere"
          onMouseDown={(event) => event.preventDefault()}
          className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs font-medium text-[#4f6080] hover:bg-secondary"
        >
          Nu știi ce serviciu îți trebuie? Descrie situația
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
