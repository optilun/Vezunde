import React from "react";
import ChoiceCard from "@/components/intake/ChoiceCard";
import { ONBOARDING_PROVIDER_TYPES } from "@/lib/providerTaxonomy";
import { PROVIDER_TYPE_TO_PROFILE_TYPE } from "@/lib/profileFoundationCatalog";

export default function WizType({ data, update, next }) {
  return (
    <div className="space-y-2.5">
      {Object.entries(ONBOARDING_PROVIDER_TYPES).map(([key, label]) => (
        <ChoiceCard
          key={key}
          label={label}
          selected={data.location.provider_type === key}
          onClick={() => {
            // Module 3H.1A.1: provider_profile_type is mandatory — set from the
            // approved enum mapping, never from free text.
            update({ location: { ...data.location, provider_type: key, provider_profile_type: PROVIDER_TYPE_TO_PROFILE_TYPE[key] } });
            next();
          }}
        />
      ))}
    </div>
  );
}