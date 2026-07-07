import React from "react";
import { Link } from "react-router-dom";
import { MapPinPlus } from "lucide-react";

// Provider onboarding flow for adding a new location draft — reviewed before
// publication. Not a public correction report.
export default function NotFoundBlock() {
  return (
    <section className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
      <div className="bg-card border border-dashed border-border rounded-2xl p-8 sm:p-10 text-center">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto">
          <MapPinPlus className="w-5 h-5 text-foreground" />
        </div>
        <h2 className="mt-4 font-heading text-xl font-bold tracking-tight">Nu gasesti locatia?</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Adauga o locatie noua si trimite informatiile necesare pentru analiza. Locatia nu devine publica automat.
        </p>
        <Link
          to="/adauga-sau-revendica"
          className="mt-5 inline-block px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Adauga o locatie noua
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">Dupa aprobare, vei putea administra informatiile publice ale locatiei.</p>
      </div>
    </section>
  );
}