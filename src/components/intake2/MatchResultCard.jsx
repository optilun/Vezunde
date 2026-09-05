import React from "react";
import ResultCard from "@/components/results/ResultCard";
import { base44 } from "@/api/base44Client";

// Module UI-1: variant is derived strictly from the existing result_bucket
// value returned by matchProviders — never recomputed or overridden here.
const BUCKET_VARIANT = {
  top3: "top3",
  extended_confirmed: "confirmed",
  extended_directory: "directory",
  // Profil din director fara servicii declarate: acelasi tratament vizual ca directory,
  // avertismentul suplimentar este afisat la nivel de sectiune in MatchResults.
  structural_directory: "directory",
};

export default function MatchResultCard({ location, onSelect, selected = false, compact = false }) {
  const trackAction = (action) => {
    try {
      base44.analytics.track({
        eventName: `provider_recommendation_${action}`,
        properties: {
          analytics_version: "patient-search-v1",
          contract_version: location.recommendation_contract_version || "legacy",
          provider_location_id: location.id,
          result_bucket: location.result_bucket || "unknown",
          bucket_rank: Number(location.bucket_rank) || null,
          recommendation_confidence: location.recommendation_confidence || "unknown",
        },
      });
    } catch (_error) {
      // Analytics must never block navigation or a phone action.
    }
  };

  return (
    <ResultCard
      location={location}
      variant={BUCKET_VARIANT[location.result_bucket] || "neutral"}
      onProfileClick={() => trackAction("profile_opened")}
      onPhoneClick={() => trackAction("phone_clicked")}
      onSelect={onSelect}
      selected={selected}
      compact={compact}
    />
  );
}
