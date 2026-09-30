import React from "react";
import { BadgeCheck, Check, SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TypeIcon } from "@/components/results/SearchFilters";
import { DIRECTORY_PROVIDER_FILTER_LABELS } from "@/lib/vezunde";
import { NO_FILTERS, countActiveFilters } from "@/lib/recommendationFilters";

// Filtrele listei de recomandari, in acelasi stil cu cele de pe /cauta (2026-09-30): pastila
// „Filtre” cu numarul lor, iar alegerile se fac intr-un meniu compact, cu randuri de tip bifa.
// Se aplica pe loc; meniul spune cate locatii raman. Filtrele restrang doar lista (vezi
// src/lib/recommendationFilters.js).

const checkRow = "relative flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-medium transition hover:border-[#a7b4c9] hover:bg-[#f7f8fa] has-[:checked]:border-[#4f6080] has-[:checked]:bg-[#eff1f5] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#4f6080]";

function CheckMark({ checked }) {
  return (
    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-[#4f6080] bg-[#4f6080] text-white" : "border-[#c5ccd8] bg-white"}`}>
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

export default function RecommendationFilterMenu({ filters, onChange, typeOptions, trustedCount, totalCount, shownCount }) {
  const activeCount = countActiveFilters(filters);
  const showTypes = typeOptions.length > 1 || filters.types.length > 0;
  const showTrusted = trustedCount < totalCount || filters.trustedOnly;
  const toggleType = (key) => onChange({
    ...filters,
    types: filters.types.includes(key) ? filters.types.filter((value) => value !== key) : [...filters.types, key],
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#d7dce4] bg-card px-4 text-sm font-semibold shadow-sm transition hover:border-[#4f6080] hover:bg-[#eff1f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]"
        >
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          Filtre
          {activeCount > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"><span className="sr-only">, active: </span>{activeCount}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-0"
      >
        <div className="max-h-[min(60dvh,26rem)] space-y-4 overflow-y-auto p-3">
          {showTypes && (
            <fieldset>
              <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Tipul locației</legend>
              <div className="mt-2 grid gap-1.5">
                {typeOptions.map(({ key, count }) => {
                  const checked = filters.types.includes(key);
                  return (
                    <label key={key} className={checkRow}>
                      <input className="sr-only" type="checkbox" checked={checked} onChange={() => toggleType(key)} />
                      <span aria-hidden="true" className="text-[#4f6080]"><TypeIcon type={key} /></span>
                      <span className="min-w-0 flex-1 truncate">{DIRECTORY_PROVIDER_FILTER_LABELS[key] || key}</span>
                      <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
                      <CheckMark checked={checked} />
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
          {showTrusted && (
            <fieldset>
              <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Profil</legend>
              <div className="mt-2">
                <label className={checkRow}>
                  <input className="sr-only" type="checkbox" checked={filters.trustedOnly} onChange={() => onChange({ ...filters, trustedOnly: !filters.trustedOnly })} />
                  <span aria-hidden="true" className="text-[#4f6080]"><BadgeCheck className="h-5 w-5" strokeWidth={1.7} /></span>
                  <span className="min-w-0 flex-1">Doar verificate sau revendicate</span>
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">{trustedCount}</span>
                  <CheckMark checked={filters.trustedOnly} />
                </label>
              </div>
            </fieldset>
          )}
        </div>
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onChange(NO_FILTERS)}
              disabled={activeCount === 0}
              className="min-h-11 text-sm underline disabled:no-underline disabled:opacity-40"
            >
              Resetează
            </button>
            <p aria-live="polite" className="text-xs tabular-nums text-muted-foreground">
              Se afișează <strong className="font-semibold text-foreground">{shownCount}</strong> din {totalCount}
            </p>
          </div>
          <p className="pb-1 text-[11px] leading-relaxed text-muted-foreground">Filtrele ascund opțiuni din listă și de pe hartă. Ordinea calculată de VIASEE și cererea trimisă rămân neschimbate.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
