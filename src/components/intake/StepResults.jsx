import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { rankLocations } from "@/lib/vezunde";
import ResultCard from "@/components/intake/ResultCard";

export default function StepResults({ data, onRequest }) {
  const [results, setResults] = useState(null);

  useEffect(() => {
    base44.entities.Location.list().then((locations) => {
      setResults(rankLocations(locations, data.services, data.city).slice(0, 6));
    });
  }, [data.services, data.city]);

  if (!results) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-10">
        <Loader2 className="w-4 h-4 animate-spin" /> Cautam locuri potrivite...
      </div>
    );
  }

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
          {results.map((loc) => (
            <ResultCard key={loc.id} location={loc} serviceKeys={data.services} onRequest={onRequest} />
          ))}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">
        Rezultate ordonate dupa potrivirea serviciilor si calitatea profilului. Vezunde nu afiseaza preturi si nu garanteaza disponibilitatea.
      </p>
    </div>
  );
}