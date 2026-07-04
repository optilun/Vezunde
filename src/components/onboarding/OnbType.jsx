import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { PROVIDER_TYPES } from "@/lib/vezunde";

export default function OnbType({ data, update, onNext }) {
  return (
    <div className="space-y-3">
      {Object.entries(PROVIDER_TYPES).map(([key, label]) => (
        <ChoiceCard
          key={key}
          label={label}
          selected={data.provider_type === key}
          onClick={() => { update({ provider_type: key }); onNext(); }}
        />
      ))}
    </div>
  );
}