import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROFESSIONAL_TYPES } from "@/lib/vezunde";

export default function ClaimStepTeam({ data, update, onNext }) {
  const toggle = (key) => {
    update({
      team_types: data.team_types.includes(key)
        ? data.team_types.filter((t) => t !== key)
        : [...data.team_types, key],
    });
  };

  return (
    <div>
      <div className="space-y-3">
        {Object.entries(PROFESSIONAL_TYPES).map(([key, label]) => (
          <ChoiceCard
            key={key}
            label={label}
            selected={data.team_types.includes(key)}
            onClick={() => toggle(key)}
          />
        ))}
      </div>
      <ContinueButton onClick={() => onNext()} disabled={data.team_types.length === 0} />
    </div>
  );
}