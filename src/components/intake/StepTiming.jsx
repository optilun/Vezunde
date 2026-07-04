import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { TIMING_OPTIONS } from "@/lib/intake";

export default function StepTiming({ data, update, onNext }) {
  return (
    <div className="space-y-3">
      {TIMING_OPTIONS.map((t) => (
        <ChoiceCard
          key={t.key}
          label={t.label}
          selected={data.timing === t.label}
          onClick={() => {
            update({ timing: t.label, urgency: t.urgency });
            onNext();
          }}
        />
      ))}
    </div>
  );
}