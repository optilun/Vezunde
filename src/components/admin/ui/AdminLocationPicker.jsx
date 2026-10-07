import React, { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { buildLocationIndex, searchLocationIndex } from "@/lib/adminSearch";
import { profileControlLabel } from "@/lib/adminLabels";
import { cn } from "@/lib/utils";

// Alegerea unei locații din ~1.600 (2026-10-07): căutare pe nume/oraș/județ, fără diacritice, în loc
// de lista nativă cu toate locațiile. Se arată primele 50 de potriviri; dacă știi câte servicii are
// fiecare locație, poți filtra „doar cu servicii”.
//   locations: [{ id, name, public_display_name, city, county, profile_control_status, ... }]
//   counts: { [locationId]: număr } sau null
const MAX_RESULTS = 50;

export default function AdminLocationPicker({
  locations,
  value,
  onChange,
  counts = null,
  countLabel = "servicii",
  label = "Locația",
  placeholder = "Alege o locație",
  disabled = false,
}) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyCounted, setOnlyCounted] = useState(false);

  const index = useMemo(() => buildLocationIndex(locations || []), [locations]);
  const selected = useMemo(() => (locations || []).find((item) => item.id === value) || null, [locations, value]);
  const { items, total } = useMemo(
    () => searchLocationIndex(index, query, {
      limit: MAX_RESULTS,
      filter: onlyCounted && counts ? (location) => (counts[location.id] || 0) > 0 : null,
    }),
    [index, query, onlyCounted, counts],
  );

  const choose = (id) => {
    onChange(id);
    setOpen(false);
  };

  const nameOf = (location) => location.public_display_name || location.name || "Locație fără nume";
  const placeOf = (location) => {
    const city = location.city || "";
    const county = location.county && location.county !== city ? location.county : "";
    return [city, county].filter(Boolean).join(", ") || "fără localitate";
  };

  return (
    <div>
      <span id={labelId} className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setQuery(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-labelledby={labelId}
            aria-haspopup="listbox"
            aria-expanded={open}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 text-left text-sm transition-colors hover:bg-secondary/40 disabled:opacity-50 sm:min-h-10"
          >
            <span className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {selected ? (
                <span className="min-w-0 truncate">
                  <span className="font-medium">{nameOf(selected)}</span>
                  <span className="text-muted-foreground"> · {placeOf(selected)}</span>
                </span>
              ) : (
                <span className="truncate text-muted-foreground">{locations ? placeholder : "Se încarcă locațiile…"}</span>
              )}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(34rem,calc(100vw-2rem))] p-0">
          <Command shouldFilter={false} label="Caută locația">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Scrie numele sau orașul…"
              aria-label="Caută locația"
              className="text-base sm:text-sm"
            />
            {counts && (
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <button
                  type="button"
                  aria-pressed={onlyCounted}
                  onClick={() => setOnlyCounted((current) => !current)}
                  className={cn(
                    "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors",
                    onlyCounted ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  Doar cu {countLabel}
                </button>
                <span className="text-[11px] text-muted-foreground">{total} {total === 1 ? "locație" : "locații"}</span>
              </div>
            )}
            <CommandList className="max-h-72">
              <CommandEmpty>Nicio locație nu se potrivește.</CommandEmpty>
              {items.map((location) => {
                const count = counts ? counts[location.id] || 0 : null;
                const control = location.profile_control_status;
                return (
                  <CommandItem
                    key={location.id}
                    value={location.id}
                    onSelect={() => choose(location.id)}
                    className="min-h-11 gap-3 px-3 py-2"
                  >
                    <Check className={cn("h-4 w-4", location.id === value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{nameOf(location)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{placeOf(location)}</span>
                    </span>
                    {control && control !== "directory" && (
                      <span className="shrink-0 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {profileControlLabel(control)}
                      </span>
                    )}
                    {count !== null && count > 0 && (
                      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{count} {countLabel}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandList>
            {total > items.length && (
              <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">
                Se arată primele {items.length} din {total}. Scrie mai mult ca să restrângi.
              </p>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
