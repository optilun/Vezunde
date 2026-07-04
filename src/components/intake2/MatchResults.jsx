import React, { useState } from "react";
import { Link } from "react-router-dom";
import MatchResultCard from "./MatchResultCard";

const TIER_LABELS = {
  oras: "In orasul tau",
  apropiere: "In zona apropiata",
  judet: "In judet",
  national: "In alte orase din Romania",
};

export default function MatchResults({ results }) {
  const [showMore, setShowMore] = useState(false);
  const top3 = results.slice(0, 3);
  const rest = results.slice(3);

  if (results.length === 0) {
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

  let lastTier = null;

  return (
    <div>
      <h2 className="font-heading text-xl sm:text-2xl font-bold tracking-tight">Cele mai potrivite optiuni pentru tine</h2>
      <div className="mt-5 space-y-3">
        {top3.map((loc) => <MatchResultCard key={loc.id} location={loc} />)}
      </div>

      {rest.length > 0 && !showMore && (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="mt-6 w-full rounded-2xl border border-border bg-card px-5 py-3.5 text-sm font-semibold hover:border-foreground/40 transition-colors"
        >
          Vezi mai multe optiuni ({rest.length})
        </button>
      )}

      {showMore && (
        <div className="mt-6 space-y-3">
          {rest.map((loc) => {
            const showHeader = loc.expansion_tier !== lastTier;
            lastTier = loc.expansion_tier;
            return (
              <React.Fragment key={loc.id}>
                {showHeader && (
                  <div className="pt-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {TIER_LABELS[loc.expansion_tier]}
                  </div>
                )}
                <MatchResultCard location={loc} />
              </React.Fragment>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground/80">
        Ordinea reflecta doar potrivirea serviciilor, echipa, dotarile, locatia si verificarea profilului. Vezunde nu ofera diagnostic medical.
      </p>
    </div>
  );
}