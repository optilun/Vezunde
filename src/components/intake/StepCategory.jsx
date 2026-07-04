import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { INTAKE_CATEGORIES } from "@/lib/intake";

export default function StepCategory({ data, update, onNext, aiSuggestion, aiLoading }) {
  return (
    <div className="space-y-3">
      {aiLoading && (
        <div className="text-sm text-muted-foreground bg-secondary rounded-xl px-4 py-3">
          Analizam mesajul tau pentru a te ghida mai repede...
        </div>
      )}
      {aiSuggestion?.safety_note_required && (
        <div className="text-sm text-muted-foreground bg-secondary rounded-xl px-4 py-3">
          Vezunde nu ofera diagnostic medical. Te ajutam sa gasesti unde poti merge pentru evaluare.
        </div>
      )}
      {INTAKE_CATEGORIES.map((c) => (
        <ChoiceCard
          key={c.key}
          label={c.label}
          hint={c.hint}
          selected={data.category === c.key}
          suggested={aiSuggestion?.suggested_category === c.key}
          onClick={() => {
            update({ category: c.key, detailLabel: "", for_whom: "", services: [] });
            onNext(c.key);
          }}
        />
      ))}
    </div>
  );
}