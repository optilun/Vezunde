import React from "react";
import { CATEGORIES } from "@/lib/vezunde";

export default function StepNeed({ data, update, onNext }) {
  const canContinue = !!data.category;
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold tracking-tight">Ce ai nevoie?</h2>
      <p className="mt-2 text-sm text-muted-foreground">Descrie in cuvintele tale sau alege o categorie.</p>
      <textarea
        value={data.description}
        onChange={(e) => update({ description: e.target.value })}
        placeholder="Ex: Copilul meu vede tot mai greu la tabla..."
        rows={3}
        className="mt-5 w-full bg-card border border-border rounded-xl p-4 text-sm outline-none focus:border-primary/50 transition-colors resize-none"
      />
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => update({ category: cat.key, services: cat.services })}
            className={`rounded-xl border px-4 py-3 text-sm font-medium text-left transition-colors ${
              data.category === cat.key
                ? "border-primary bg-accent text-primary"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <button
        onClick={onNext}
        disabled={!canContinue}
        className="mt-8 w-full sm:w-auto bg-primary text-primary-foreground rounded-full px-8 py-3 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        Continua
      </button>
    </div>
  );
}