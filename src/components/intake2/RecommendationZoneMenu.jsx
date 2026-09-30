import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Globe, Loader2, Map as MapIcon, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Zona cautarii, intr-o singura pastila (2026-09-30).
//
// Inainte, extinderea zonei aparea in trei locuri: linkuri sub Top 3, un panou cu patru butoane si
// o caseta despre aria cautarii. Acum pastila spune unde s-a cautat („Cluj-Napoca”), iar meniul ei
// arata aria curenta si pasii mai largi: judetul si toata tara. Extinderea cheama aceleasi
// functii ca inainte (aceeasi cerere catre server, aceeasi analitica); aici se schimba doar unde
// se apasa. La nivel national serverul intoarce numai profiluri revendicate sau verificate.

const SCOPE_RANK = { locality: 0, county: 1, national: 2 };

export default function RecommendationZoneMenu({
  scope = "locality",
  cityName = "",
  countyName = "",
  open,
  onOpenChange,
  busyScope = null,
  error = "",
  onExpandCounty = undefined,
  onExpandNational = undefined,
  onChangeLocation,
  onReviewCriteria,
}) {
  const current = SCOPE_RANK[scope] === undefined ? "locality" : scope;
  const localityTitle = cityName || "Localitatea aleasă";
  const countyTitle = countyName ? `Județul ${countyName}` : "Județul";
  const label = current === "national" ? "Toată România" : current === "county" ? countyTitle : localityTitle;
  const busy = busyScope !== null;

  const options = [
    { key: "locality", title: localityTitle, hint: "Doar localitatea aleasă", Icon: MapPin, expand: undefined },
    { key: "county", title: countyTitle, hint: "Include și celelalte localități din județ", Icon: MapIcon, expand: onExpandCounty },
    { key: "national", title: "Toată România", hint: "Doar profiluri revendicate sau verificate", Icon: Globe, expand: onExpandNational },
  ].filter((option) => option.key === current || (SCOPE_RANK[option.key] > SCOPE_RANK[current] && option.expand));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Zona căutării: ${label}`}
          className="inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-full border border-[#d7dce4] bg-card px-4 text-sm font-semibold shadow-sm transition hover:border-[#4f6080] hover:bg-[#eff1f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]"
        >
          {busy
            ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-[#4f6080]" />
            : <MapPin aria-hidden="true" className="h-4 w-4 shrink-0 text-[#4f6080]" />}
          <span className="truncate">{busy ? "Extindem căutarea..." : label}</span>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-3"
      >
        <p className="px-1 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Aria căutării</p>
        <ul className="mt-2 space-y-1.5">
          {options.map(({ key, title, hint, Icon, expand }) => {
            const isCurrent = key === current;
            const rowClass = "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left";
            const content = (
              <>
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eff1f5] text-[#4f6080]"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{title}</span>
                  <span className="block text-xs leading-snug text-muted-foreground">{hint}</span>
                </span>
              </>
            );
            return (
              <li key={key}>
                {isCurrent ? (
                  <div aria-current="true" className={`${rowClass} border-[#4f6080] bg-[#eff1f5]`}>
                    {content}
                    <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[#4f6080]" strokeWidth={3} />
                    <span className="sr-only">Aria curentă</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={expand}
                    disabled={busy}
                    className={`${rowClass} border-border bg-card transition hover:border-[#4f6080] hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f6080]`}
                  >
                    {content}
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#4f6080]">
                      {busyScope === key ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <>Extinde <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></>}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {error && <p role="alert" className="mt-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-1 border-t border-border pt-1 text-xs">
          <button type="button" onClick={onChangeLocation} className="inline-flex min-h-11 items-center px-2 font-semibold text-[#4f6080] underline underline-offset-4">Schimbă localitatea</button>
          <button type="button" onClick={onReviewCriteria} className="inline-flex min-h-11 items-center px-2 font-semibold text-[#4f6080] underline underline-offset-4">Revizuiește criteriile</button>
          <Link to="/cauta" className="inline-flex min-h-11 items-center px-2 font-semibold text-[#4f6080] underline underline-offset-4">Directorul complet</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
