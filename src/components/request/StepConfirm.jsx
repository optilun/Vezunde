import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import ProviderCard from "@/components/ProviderCard";

export default function StepConfirm({ matches, data }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <CheckCircle2 className="w-8 h-8 text-primary" />
        <h2 className="font-heading text-2xl font-bold tracking-tight">Cererea ta a fost inregistrata</h2>
      </div>
      <p className="mt-3 text-sm text-muted-foreground max-w-lg">
        Pe baza nevoii tale, iti aratam unde poti merge in {data.city}. Poti suna direct la numerele afisate pe profiluri, oricand alegi tu.
      </p>
      {data.category === "consult_oftalmologic" && (
        <p className="mt-3 text-sm text-muted-foreground max-w-lg bg-secondary rounded-xl px-4 py-3">
          Pentru simptome, o evaluare de specialitate este necesara. Vezunde nu ofera diagnostic medical.
        </p>
      )}
      <div className="mt-8">
        <h3 className="font-heading font-bold">Potriviri posibile</h3>
        {matches.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nu am gasit inca furnizori potriviti in {data.city}. Poti explora toti furnizorii disponibili.
          </p>
        ) : (
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            {matches.map((loc) => (
              <ProviderCard key={loc.id} location={loc} matchedServices={data.services} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/cauta" className="bg-primary text-primary-foreground rounded-full px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity">Vezi toti furnizorii</Link>
        <Link to="/" className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary/40 transition-colors">Inapoi acasa</Link>
      </div>
    </div>
  );
}