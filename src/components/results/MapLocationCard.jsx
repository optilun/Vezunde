import React from "react";
import { Link, useLocation } from "react-router-dom";
import LocationThumb, { typeVisual } from "./LocationThumb";
import TrustBadge from "./TrustBadge";

export default function MapLocationCard({ point, onClose }) {
  const route = useLocation();
  const returnState = route.pathname === "/rezultate" ? { resultsReturn: route.state } : undefined;
  const visual = typeVisual(point.provider_type);
  return (
    <section aria-label={"Detalii locatie: " + point.name} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }} className="absolute inset-x-3 bottom-3 z-[500] max-h-[55%] overflow-y-auto rounded-2xl border border-border bg-card p-3.5 shadow-lg sm:inset-x-auto sm:left-3 sm:w-80">
      <div className="flex items-start gap-3">
        <LocationThumb name={point.name} providerType={point.provider_type} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{visual.label}</div>
          <p className="mt-0.5 font-heading text-sm font-bold leading-tight text-foreground">{point.name}</p>
          {point.address && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.address}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TrustBadge status={point.profile_control_status} />
            {point.map_precision !== "exact" && (
              <span className="text-[10px] font-medium text-muted-foreground">Poziție aproximativă</span>
            )}
          </div>
          {point.is_request_result === false && <p className="mt-2 text-xs text-muted-foreground">Din directorul national</p>}
          {point.is_request_result === true && <p className="mt-2 text-xs font-semibold text-[#4f6080]">Rezultat al cererii tale</p>}
          <Link
            to={`/furnizor/${point.id}`} state={returnState}
            className="mt-2.5 inline-flex min-h-11 items-center text-xs font-semibold text-foreground underline underline-offset-4"
          >
            Vezi profilul
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide"
          className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </div>
    </section>
  );
}
