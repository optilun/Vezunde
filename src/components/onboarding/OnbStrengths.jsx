import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { SERVICES } from "@/lib/vezunde";

const MAX = 5;

export default function OnbStrengths({ data, update, onNext }) {
  const toggle = (key) => {
    if (data.strengths.includes(key)) {
      update({ strengths: data.strengths.filter((s) => s !== key) });
    } else if (data.strengths.length < MAX) {
      update({ strengths: [...data.strengths, key] });
    }
  };

  const pool = data.services.length > 0 ? data.services : Object.keys(SERVICES);

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Alege maximum {MAX} specializari care va diferentiaza. {data.strengths.length}/{MAX} selectate.
      </p>
      <div className="flex flex-wrap gap-2">
        {pool.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
              data.strengths.includes(key)
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/40"
            } ${!data.strengths.includes(key) && data.strengths.length >= MAX ? "opacity-40" : ""}`}
          >
            {SERVICES[key]}
          </button>
        ))}
      </div>
      <ContinueButton onClick={() => onNext()} disabled={data.strengths.length === 0} />
    </div>
  );
}