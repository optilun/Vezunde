import React from "react";
import { Link } from "react-router-dom";
import { CATEGORIES } from "@/lib/vezunde";

export default function QuickCategories() {
  return (
    <section className="max-w-3xl mx-auto px-5 mt-8">
      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.key}
            to={`/cerere?categorie=${cat.key}`}
            className="rounded-full border border-border bg-card/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-card transition-colors"
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </section>
  );
}