import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function ClosingCta() {
  return (
    <section className="max-w-3xl mx-auto px-5 mt-28 sm:mt-40 text-center">
      <p className="text-sm font-medium text-primary">Gata sa incepi?</p>
      <h2 className="mt-3 font-heading text-3xl sm:text-5xl font-extrabold tracking-[-0.02em]">
        Spune ce ai nevoie.
      </h2>
      <p className="mt-4 text-muted-foreground max-w-md mx-auto">
        Dureaza mai putin de un minut sa descrii nevoia ta si sa vezi unde poti merge.
      </p>
      <Link
        to="/cerere"
        className="mt-8 inline-flex items-center gap-2 bg-foreground text-background rounded-full px-7 py-3.5 font-medium hover:bg-primary transition-colors"
      >
        Incepe acum <ArrowRight className="w-4 h-4" />
      </Link>
    </section>
  );
}