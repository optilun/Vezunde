import React, { useState } from "react";
import { Link } from "react-router-dom";
import MatchResultCard from "./MatchResultCard";

function RoutingNotice({ meta }) {
  if (!meta?.routing_mode) return null;
  if (meta.routing_mode === "perimeter") {
    return (
      <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs leading-relaxed text-green-900">
        Am cautat locatii aflate in perimetrul locatiei tale curente. Distanța este aproximativă și se calculează după coordonatele disponibile public pentru fiecare locație.
      </div>
    );
  }
  if (meta.routing_mode === "locality") {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Am cautat dupa localitatea selectata: {meta.client_address_text || "localitate selectata"}.
      </div>
    );
  }
  return null;
}

// Module 3E: sections are driven STRICTLY by result_bucket from the backend.
// Top 3 = result_bucket === "top3" only — never a positional slice.
export default function MatchResults({ results, meta }) {
  const [showMore, setShowMore] = useState(false);
  const list = results || [];
  const top3 = list.filter((r) => r.result_bucket === "top3");
  const confirmed = list.filter((r) => r.result_bucket === "extended_confirmed");
  const directory = list.filter((r) => r.result_bucket === "extended_directory");
  const moreCount = confirmed.length + directory.length;

  if (top3.length === 0 && moreCount === 0) {
    return (
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">Nu avem inca profiluri relevante in zona ta.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Daca ai folosit locatia curenta, poti incerca si cautarea manuala dupa localitate sau cautarea nationala.
        </p>
        <RoutingNotice meta={meta} />
        <Link to="/cauta" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
          Exploreaza toti furnizorii
        </Link>
      </div>
    );
  }

  const expanded = showMore || top3.length === 0;

  return (
    <div>
      {top3.length > 0 ? (
        <>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Cele mai potrivite optiuni</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Selectate pe baza serviciilor confirmate, verificarii profilului si distantei fata de tine.
          </p>
          <RoutingNotice meta={meta} />
          <div className="mt-5 space-y-3">
            {top3.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </>
      ) : (
        <>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Nu avem inca optiuni confirmate pentru aceasta nevoie in zona ta</h2>
          {directory.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Poti vedea mai jos cateva profiluri din director.
            </p>
          )}
          <RoutingNotice meta={meta} />
        </>
      )}

      {moreCount > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="mt-6 w-full rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Vezi mai multe optiuni ({moreCount})
        </button>
      )}

      {expanded && confirmed.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mai multe optiuni relevante</div>
          <div className="mt-3 space-y-3">
            {confirmed.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </div>
      )}

      {expanded && directory.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Optiuni din director</div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aceste profiluri provin din surse publice. Vezunde nu a confirmat toate informatiile afisate.
          </p>
          <div className="mt-3 space-y-3">
            {directory.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground/80">
        Ordinea reflecta potrivirea serviciilor, verificarea profilului, locatia si modul de primire publicat de furnizor. Vezunde nu ofera diagnostic medical.
      </p>
    </div>
  );
}
