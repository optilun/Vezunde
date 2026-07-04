import React from "react";
import ContinueButton from "@/components/intake/ContinueButton";
import { SERVICES } from "@/lib/vezunde";
import { STRENGTH_KEYS, MAX_STRENGTHS } from "@/lib/claimConfig";

const LABELS = { ...SERVICES, ochi_uscat: "Ochi uscat" };

export default function ClaimStepStrengths({ data, update, onNext }) {
  const toggle = (key) => {
    if (data.strengths.includes(key)) {
      update({ strengths: data.strengths.filter((s) => s !== key) });
    } else if (data.strengths.length < MAX_STRENGTHS) {
      update({ strengths: [...data.strengths, key] });
    }
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Maximum {MAX_STRENGTHS} selectii. {data.strengths.length}/{MAX_STRENGTHS} alese.
      </p>
      <div className="flex flex-wrap gap-2">
        {STRENGTH_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
              data.strengths.includes(key)
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card hover:border-foreground/40"
            } ${!data.strengths.includes(key) && data.strengths.length >= MAX_STRENGTHS ? "opacity-40" : ""}`}
          >
            {LABELS[key]}
          </button>
        ))}
      </div>
      <ContinueButton onClick={() => onNext()} disabled={data.strengths.length === 0} />
    </div>
  );
}