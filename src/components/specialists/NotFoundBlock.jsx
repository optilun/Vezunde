import React from "react";
import { Link } from "react-router-dom";
import { FileSearch } from "lucide-react";

// Clarifies this path creates a reviewable request, not instant publishing.
export default function NotFoundBlock() {
  return (
    <section className="max-w-3xl mx-auto px-5 py-14 sm:py-20">
      <div className="bg-card border border-dashed border-border rounded-2xl p-8 sm:p-10 text-center">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto">
          <FileSearch className="w-5 h-5 text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-heading text-xl font-bold tracking-tight">Nu gasesti locatia?</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Este posibil ca locatia sa nu fie inca listata sau ca informatiile disponibile sa fie incomplete.
        </p>
        <Link
          to="/adauga-sau-revendica"
          className="mt-5 inline-block px-5 py-2.5 rounded-full border border-border bg-background text-sm font-medium hover:border-foreground/40 transition-colors"
        >
          Solicita adaugarea sau corectarea
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">Solicitarea este analizata inainte de a deveni publica.</p>
      </div>
    </section>
  );
}