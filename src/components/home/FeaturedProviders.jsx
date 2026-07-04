import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderCard from "@/components/ProviderCard";

export default function FeaturedProviders() {
  const [locations, setLocations] = useState(null);

  useEffect(() => {
    base44.entities.Location.list("-response_quality_score", 4).then(setLocations);
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-5 mt-24 sm:mt-32">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">Furnizori pe Vezunde</h2>
          <p className="mt-2 text-muted-foreground text-sm">Exemple fictive, pentru demonstratie.</p>
        </div>
        <Link to="/cauta" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Vezi toti <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        {locations === null && (
          <p className="text-sm text-muted-foreground">Se incarca...</p>
        )}
        {locations?.map((loc) => (
          <ProviderCard key={loc.id} location={loc} />
        ))}
      </div>
      <Link to="/cauta" className="sm:hidden mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        Vezi toti furnizorii <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}