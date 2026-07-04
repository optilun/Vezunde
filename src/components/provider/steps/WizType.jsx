import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { ONBOARDING_PROVIDER_TYPES } from "@/lib/providerTaxonomy";

export default function WizType({ data, update, next }) {
  return (
    <div className="space-y-2.5">
      {Object.entries(ONBOARDING_PROVIDER_TYPES).map(([key, label]) => (
        <ChoiceCard
          key={key}
          label={label}
          selected={data.location.provider_type === key}
          onClick={() => {
            update({ location: { ...data.location, provider_type: key } });
            next();
          }}
        />
      ))}
    </div>
  );
}