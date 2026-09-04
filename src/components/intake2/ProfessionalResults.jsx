import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { matchProfessionalsForRequest } from "@/lib/professionalSearch";
import ProfessionalMatchResultCard from "./ProfessionalMatchResultCard";

// Rezultatele pentru specialisti, in aceeasi structura ca cele pentru locatii.
//
// 2026-09-03. Sectiunile sunt derivate STRICT din `result_bucket` primit de la server - Top 3
// inseamna `result_bucket === "top3"`, niciodata primele trei din lista. Este exact regula deja
// aplicata la locatii si e important sa ramana asa: daca frontendul ar taia pozitional, ar putea
// prezenta drept "cea mai potrivita optiune" un profil pe care serverul l-a clasat in coada.
//
// Cererea nu se reinterpreteaza aici. Contextul (chei de serviciu rezolvate, nivel de nevoie,
// localitate, arie) vine din raspunsul motorului de locatii si e trimis mai departe ca atare.

function EmptyState({ status, onBackToLocations }) {
  const message = status === "no_professionals_in_scope"
    ? "Nu am găsit încă specialiști cu profil verificat în aria selectată."
    : "Nu am găsit specialiști cu profil verificat pentru această cerere.";

  return (
    <div className="rounded-2xl border border-border bg-secondary/40 px-5 py-6">
      <p className="text-sm font-semibold text-foreground">{message}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        Specialiștii apar aici doar după ce își verifică profilul și își dau acordul explicit să fie
        afișați la o locație publică. Până atunci, clinicile și opticile din zonă rămân calea cea
        mai directă.
      </p>
      <button
        type="button"
        onClick={onBackToLocations}
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Vezi clinicile și opticile
      </button>
    </div>
  );
}

export default function ProfessionalResults({
  meta,
  draft = null,
  onBackToLocations,
  onCountChange = null,
}) {
  const [state, setState] = useState({ status: "loading", data: null, error: "" });
  const [showMore, setShowMore] = useState(false);
  const lastImpressionKey = useRef("");

  const scopeKey = `${meta?.selected_locality_siruta_code || ""}:${meta?.query_scope || "locality"}:${(meta?.resolved_service_keys || []).join(",")}`;

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: "" });
    setShowMore(false);

    matchProfessionalsForRequest(meta, draft)
      .then((data) => {
        if (cancelled) return;
        setState({ status: "ready", data, error: "" });
        if (onCountChange) onCountChange(Array.isArray(data.results) ? data.results.length : 0);
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          error: error?.message || "Recomandările de specialiști nu au putut fi încărcate.",
        });
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  const results = Array.isArray(state.data?.results) ? state.data.results : [];
  const top3 = results.filter((entry) => entry.result_bucket === "top3");
  const confirmed = results.filter((entry) => entry.result_bucket === "extended_confirmed");
  const directory = results.filter((entry) => entry.result_bucket === "extended_directory");
  const moreCount = confirmed.length + directory.length;
  const needLevel = state.data?.need_level || meta?.need_level || "general";

  useEffect(() => {
    if (state.status !== "ready") return;
    const impressionKey = results.length > 0
      ? results.map((entry) => `${entry.id}:${entry.result_bucket}:${entry.bucket_rank}`).join("|")
      : `empty:${state.data?.coverage_status || "unknown"}`;
    if (impressionKey === lastImpressionKey.current) return;
    lastImpressionKey.current = impressionKey;
    try {
      base44.analytics.track({
        eventName: "professional_recommendation_results_viewed",
        properties: {
          analytics_version: "patient-search-v1",
          contract_version: state.data?.recommendation_contract_version || "legacy",
          coverage_status: state.data?.coverage_status || "unknown",
          query_scope: state.data?.query_scope || "locality",
          need_level: needLevel,
          result_count: results.length,
          top3_count: top3.length,
          confirmed_count: confirmed.length,
          directory_count: directory.length,
        },
      });
    } catch (_error) {
      // Afisarea recomandarilor nu depinde de analitica.
    }
  }, [confirmed.length, directory.length, needLevel, results, state.data, state.status, top3.length]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-5 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Căutăm specialiștii verificați din aria selectată...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-border bg-secondary/40 px-5 py-6">
        <p role="alert" className="text-sm font-semibold text-foreground">{state.error}</p>
        <button
          type="button"
          onClick={onBackToLocations}
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 text-sm font-medium"
        >
          Vezi clinicile și opticile
        </button>
      </div>
    );
  }

  if (results.length === 0) {
    return <EmptyState status={state.data?.coverage_status} onBackToLocations={onBackToLocations} />;
  }

  const expanded = showMore || top3.length === 0;

  return (
    <div>
      {top3.length > 0 && (
        <>
          <h2 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">Cei mai potriviți specialiști</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Selectați pe baza specializărilor declarate, a serviciilor confirmate la locațiile unde
            lucrează și a verificării profilului.
          </p>
          <div className="mt-5 space-y-3">
            {top3.map((entry) => (
              <ProfessionalMatchResultCard key={entry.id} professional={entry} needLevel={needLevel} />
            ))}
          </div>
        </>
      )}

      {moreCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="mt-6 min-h-12 w-full rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:border-foreground/40"
        >
          Vezi mai mulți specialiști ({moreCount})
        </button>
      )}

      {expanded && confirmed.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Alți specialiști relevanți</div>
          <div className="mt-3 space-y-3">
            {confirmed.map((entry) => (
              <ProfessionalMatchResultCard key={entry.id} professional={entry} needLevel={needLevel} />
            ))}
          </div>
        </div>
      )}

      {expanded && directory.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            Alți specialiști din zonă
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Profilurile sunt verificate, dar specializările declarate nu acoperă explicit ce ai cerut.
          </p>
          <div className="mt-3 space-y-3">
            {directory.map((entry) => (
              <ProfessionalMatchResultCard key={entry.id} professional={entry} needLevel={needLevel} />
            ))}
          </div>
        </div>
      )}

      {/* Cererea se trimite catre locatii, nu catre persoane: fluxul de lead-uri, acordul de
          distribuire si chatul controlat sunt construite intre pacient si o locatie care raspunde.
          Spunem asta explicit aici, in loc sa lasam pacientul sa caute un buton care nu exista. */}
      <div className="mt-8 rounded-2xl border border-border bg-secondary/40 px-5 py-4">
        <p className="text-sm font-semibold text-foreground">Vrei sa trimiti cererea?</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Cererea ajunge la locațiile unde lucrează specialiștii, pentru că ele confirmă programul și
          răspund. Alege tabul cu clinici și optici ca să o trimiți.
        </p>
        <button
          type="button"
          onClick={onBackToLocations}
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Vezi clinicile și opticile
        </button>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground/70">
        VIASEE nu oferă diagnostic medical. Ordinea rezultatelor reflectă specializările declarate și
        verificarea profilului. Plata nu influențează ordinea.
      </p>
    </div>
  );
}
