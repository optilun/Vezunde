import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ResultCard from "@/components/intake/ResultCard";

const TIER_LABELS = {
  oras: null, // shown in context, no header needed
  apropiere: "In apropiere",
  judet: "In acelasi judet",
  national: "In alte judete",
};

export default function StepResults({ data, onRequest }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    base44.functions.invoke("matchProviders", {
      service_keys: data.services,
      city: data.city,
      limit: 8,
    }).then((res) => setResults(res.data.results || []));
  }, [data.services, data.city]);

  if (!results) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-10">
        <Loader2 className="w-4 h-4 animate-spin" /> Cautam locuri potrivite...
      </div>
    );
  }

  let lastTier = "oras";

  return (
    <div>
      {results.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">
            Nu am gasit inca un loc potrivit in {data.city} pentru nevoia ta. Poti explora toti furnizorii disponibili.
          </p>
          <Link to="/cauta" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
            Vezi toti furnizorii
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((loc) => {
            const showHeader = loc.expansion_tier !== lastTier && TIER_LABELS[loc.expansion_tier];
            lastTier = loc.expansion_tier;
            return (
              <React.Fragment key={loc.id}>
                {showHeader && (
                  <div className="pt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {TIER_LABELS[loc.expansion_tier]}
                  </div>
                )}
                <ResultCard location={loc} onRequest={onRequest} />
              </React.Fragment>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        Rezultate bazate doar pe serviciile potrivite, echipa, locatie si verificarea profilului. Vezunde nu afiseaza preturi si nu garanteaza disponibilitatea.
      </p>
    </div>
  );
}