import React, { useState } from "react";
import { Link } from "react-router-dom";
import MatchResultCard from "./MatchResultCard";

// Module 3E: sections are driven STRICTLY by result_bucket from the backend.
// Top 3 = result_bucket === "top3" only — never a positional slice.
export default function MatchResults({ results }) {
  const [showMore, setShowMore] = useState(false);
  const list = results || [];
  const top3 = list.filter((r) => r.result_bucket === "top3");
  const confirmed = list.filter((r) => r.result_bucket === "extended_confirmed");
  const directory = list.filter((r) => r.result_bucket === "extended_directory");
  const moreCount = confirmed.length + directory.length;

  if (top3.length === 0 && moreCount === 0) {
    return (
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight">Nu am gasit inca o optiune potrivita</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nu avem inca furnizori publicati care sa acopere aceasta nevoie in zona aleasa.
        </p>
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
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Cele mai potrivite optiuni pentru tine</h2>
          <div className="mt-5 space-y-3">
            {top3.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </>
      ) : (
        <>
          <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Nu avem inca recomandari confirmate pentru aceasta nevoie</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Niciun furnizor nu are deocamdata acest serviciu confirmat in zona aleasa. Mai jos gasesti alte profiluri care ar putea fi relevante.
          </p>
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
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Alte optiuni confirmate</div>
          <div className="mt-3 space-y-3">
            {confirmed.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </div>
      )}

      {expanded && directory.length > 0 && (
        <div className="mt-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Profiluri din director</div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Informatii preluate din surse publice, neconfirmate inca de furnizor. Nu sunt recomandari Vezunde.
          </p>
          <div className="mt-3 space-y-3">
            {directory.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground/80">
        Ordinea reflecta doar potrivirea serviciilor, echipa, dotarile, locatia si verificarea profilului. Vezunde nu ofera diagnostic medical.
      </p>
    </div>
  );
}