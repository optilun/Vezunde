import React from "react";
import ProfessionalResultCard from "@/components/results/ProfessionalResultCard";
import { base44 } from "@/api/base44Client";

// Adaptorul de card pentru specialisti, perechea lui MatchResultCard.
//
// Varianta vizuala este derivata STRICT din `result_bucket` primit de la backend, niciodata
// recalculata aici - exact regula deja aplicata pentru locatii.
const BUCKET_VARIANT = {
  top3: "top3",
  extended_confirmed: "confirmed",
  extended_directory: "directory",
};

export default function ProfessionalMatchResultCard({
  professional,
  needLevel = "general",
  onSelect,
  selected = false,
}) {
  const trackAction = (action, extra = {}) => {
    try {
      base44.analytics.track({
        eventName: `professional_recommendation_${action}`,
        properties: {
          analytics_version: "patient-search-v1",
          contract_version: professional.recommendation_contract_version || "legacy",
          professional_id: professional.id,
          professional_type: professional.professional_type || "unknown",
          result_bucket: professional.result_bucket || "unknown",
          bucket_rank: Number(professional.bucket_rank) || null,
          recommendation_confidence: professional.recommendation_confidence || "unknown",
          ...extra,
        },
      });
    } catch (_error) {
      // Analitica nu blocheaza niciodata o navigare.
    }
  };

  return (
    <ProfessionalResultCard
      professional={professional}
      variant={BUCKET_VARIANT[professional.result_bucket] || "neutral"}
      needLevel={needLevel}
      onProfileClick={() => trackAction("profile_opened")}
      onLocationClick={(location) => trackAction("location_opened", { provider_location_id: location?.id || null })}
      onSelect={onSelect}
      selected={selected}
    />
  );
}
