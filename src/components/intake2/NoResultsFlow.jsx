import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Expand, MapPin, SearchX, ShieldCheck, SlidersHorizontal } from "lucide-react";

const EMPTY_STATES = {
  no_local_providers: {
    title: "Nu avem încă furnizori publicați pentru această nevoie în localitatea aleasă",
    description: "VIASEE a căutat în localitatea selectată, dar directorul nu conține încă profiluri publicate care să corespundă cererii.",
  },
  local_service_data_missing: {
    title: "Există furnizori în localitate, dar lipsesc datele necesare pentru o potrivire sigură",
    description: "Nu putem confirma momentan cine oferă serviciul căutat. Asta descrie datele disponibile în VIASEE, nu înseamnă că serviciul nu există în localitate.",
  },
  no_eligible_local_results: {
    title: "Nu avem momentan un rezultat eligibil pentru această nevoie",
    description: "Există furnizori și date locale, dar niciun profil nu îndeplinește toate condițiile de serviciu, control al profilului sau specializare.",
  },
  query_not_mapped: {
    title: "Nu am putut lega descrierea de un serviciu din catalog",
    description: "Reformulează cererea folosind câteva cuvinte simple despre serviciul sau problema practică pe care o cauți.",
  },
  query_required: {
    title: "Avem nevoie de o descriere mai clară",
    description: "Adaugă serviciul sau tipul de ajutor căutat, apoi verificăm din nou opțiunile disponibile.",
  },
  canonical_locality_required: {
    title: "Selectează o localitate din lista VIASEE",
    description: "Căutarea folosește localități validate. Alege din nou localitatea pentru a putea verifica furnizorii potriviți.",
  },
  no_local_results: {
    title: "Nu avem încă rezultate potrivite în localitatea aleasă",
    description: "Căutarea a fost limitată la localitatea selectată și nu a găsit profiluri care să poată fi prezentate ca potriviri relevante.",
  },
};

const DEFAULT_EMPTY_STATE = {
  title: "Nu avem încă rezultate potrivite în zona aleasă",
  description: "Poți modifica localitatea sau criteriile și relua căutarea.",
};

function coverageFacts(meta, countyExpanded) {
  const counts = meta?.coverage_counts || {};
  const facts = [];
  const localCount = Number(counts.local_provider_count);
  const scopeCount = Number(counts.scope_provider_count);
  const configuredCount = Number(counts.configured_matching_provider_count);
  const eligibleCount = Number(counts.eligible_provider_count);

  if (countyExpanded && Number.isFinite(scopeCount)) facts.push(`${scopeCount} profiluri publice găsite în aria județului`);
  else if (Number.isFinite(localCount)) facts.push(`${localCount} profiluri publice găsite în localitate`);
  if (Number.isFinite(configuredCount)) facts.push(`${configuredCount} profiluri cu date pentru serviciul căutat`);
  if (Number.isFinite(eligibleCount)) facts.push(`${eligibleCount} profiluri eligibile pentru recomandare`);
  return facts;
}

export default function NoResultsFlow({
  mode = "empty",
  meta,
  top3Count = 0,
  directoryCount = 0,
  countyName = "",
  onExpandCounty,
  onChangeLocation,
  onReviewCriteria,
  isExpandingCounty = false,
  actionError = "",
}) {
  const emptyState = EMPTY_STATES[meta?.coverage_status] || DEFAULT_EMPTY_STATE;
  const insufficient = mode === "insufficient";
  const countyExpanded = meta?.query_scope === "county" || meta?.routing_mode === "county";
  const resolvedCountyName = meta?.selected_county_name || countyName;
  const title = countyExpanded
    ? (insufficient
      ? (top3Count > 0
        ? `Am găsit doar ${top3Count} ${top3Count === 1 ? "opțiune confirmată" : "opțiuni confirmate"} în aria extinsă`
        : `Nu avem opțiuni confirmate nici în județul ${resolvedCountyName || "selectat"}`)
      : `Nu avem rezultate eligibile nici în județul ${resolvedCountyName || "selectat"}`)
    : (insufficient
      ? (top3Count > 0
        ? `Am găsit doar ${top3Count} ${top3Count === 1 ? "opțiune confirmată" : "opțiuni confirmate"}`
        : "Nu avem încă opțiuni confirmate pentru această nevoie")
      : emptyState.title);
  const description = countyExpanded
    ? (insufficient
      ? (directoryCount > 0
        ? "Rezultatele includ localitatea selectată și celelalte localități din județ. Profilurile suplimentare din director nu au toate informațiile confirmate."
        : "VIASEE a verificat localitatea selectată și celelalte localități din județ, fără să completeze lista cu potriviri slabe.")
      : "VIASEE a verificat localitatea selectată și celelalte localități din județ. Cererea nu a fost extinsă în afara județului.")
    : (insufficient
      ? (directoryCount > 0
        ? "Profilurile suplimentare de mai jos provin din director și nu au toate informațiile confirmate."
        : "Poți extinde căutarea în județ, modifica localitatea sau revizui criteriile.")
      : emptyState.description);
  const facts = coverageFacts(meta, countyExpanded);
  const canExpandCounty = Boolean(onExpandCounty && !countyExpanded && resolvedCountyName);

  return (
    <section className={`rounded-2xl border p-5 sm:p-6 ${insufficient ? "border-border bg-secondary/25" : "border-amber-200/80 bg-amber-50/60"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${insufficient ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-800"}`}>
          <SearchX className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>

          {(meta?.client_address_text || resolvedCountyName) && (
            <p className="mt-3 inline-flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {countyExpanded
                ? `Arie verificată: județul ${resolvedCountyName || "selectat"}, pornind de la ${meta?.client_address_text || "localitatea aleasă"}`
                : `Căutare în: ${meta?.client_address_text || "localitatea aleasă"}`}
            </p>
          )}

          {facts.length > 0 && !insufficient && (
            <div className="mt-4 rounded-xl border border-border bg-background/80 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ce am verificat</p>
              <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
                {facts.map((fact) => <span key={fact}>{fact}</span>)}
              </div>
            </div>
          )}

          <div className={`mt-5 grid gap-2 ${canExpandCounty ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {canExpandCounty && (
              <button
                type="button"
                onClick={onExpandCounty}
                disabled={isExpandingCounty}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Expand className="h-4 w-4" />
                {isExpandingCounty ? "Extindem căutarea..." : `Extinde în județul ${resolvedCountyName}`}
              </button>
            )}
            <button
              type="button"
              onClick={onChangeLocation}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${canExpandCounty ? "border border-border bg-background text-foreground hover:bg-secondary" : "bg-primary text-primary-foreground transition-opacity hover:opacity-90"}`}
            >
              <MapPin className="h-4 w-4" /> Schimbă localitatea
            </button>
            <button
              type="button"
              onClick={onReviewCriteria}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <SlidersHorizontal className="h-4 w-4" /> Revizuiește criteriile
            </button>
          </div>

          {actionError && (
            <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
              {actionError}
            </p>
          )}

          <Link
            to="/cauta"
            className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-foreground underline underline-offset-4"
          >
            <BookOpen className="h-3.5 w-3.5" /> Explorează directorul complet
          </Link>

          <p className="mt-4 flex items-start gap-2 border-t border-border/70 pt-4 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            VIASEE nu completează lista cu profiluri slab potrivite doar pentru a afișa mai multe rezultate și nu oferă diagnostic medical.
          </p>
        </div>
      </div>
    </section>
  );
}
