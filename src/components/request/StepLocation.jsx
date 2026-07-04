import React from "react";
import { MapPin } from "lucide-react";
import { CITIES } from "@/lib/vezunde";

export default function StepLocation({ data, update, onNext, onBack }) {
  return (
    <div>
      <h2 className="font-heading text-2xl font-bold tracking-tight">In ce oras?</h2>
      <p className="mt-2 text-sm text-muted-foreground">Iti aratam furnizori din orasul ales.</p>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => update({ city })}
            className={`rounded-xl border px-4 py-3 text-sm font-medium text-left inline-flex items-center gap-2 transition-colors ${
              data.city === city ? "border-primary bg-accent text-primary" : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <MapPin className="w-4 h-4" />
            {city}
          </button>
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <button onClick={onBack} className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary/40 transition-colors">Inapoi</button>
        <button
          onClick={onNext}
          disabled={!data.city}
          className="bg-primary text-primary-foreground rounded-full px-8 py-3 font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          Continua
        </button>
      </div>
    </div>
  );
}