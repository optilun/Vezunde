import React from "react";
import { Link } from "react-router-dom";
import { SERVICES } from "@/lib/vezunde";

export default function ServicesShowcase() {
  return (
    <section className="max-w-5xl mx-auto px-5 mt-28 sm:mt-40">
      <p className="text-sm font-medium text-primary">Ce poti gasi</p>
      <h2 className="mt-3 font-heading text-3xl sm:text-5xl font-extrabold tracking-[-0.02em] max-w-2xl">
        De la un simplu reglaj, pana la investigatii complete.
      </h2>
      <div className="mt-10 flex flex-wrap gap-2.5">
        {Object.entries(SERVICES).map(([key, label]) => (
          <Link
            key={key}
            to={`/cauta?serviciu=${key}`}
            className="rounded-full border border-border bg-card px-4 py-2.5 text-sm hover:border-primary/60 hover:text-primary transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}