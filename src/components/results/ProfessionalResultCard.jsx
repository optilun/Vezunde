import React from "react";
import { useLocation } from "react-router-dom";
import DecisionConfidencePanel from "@/components/results/DecisionConfidencePanel";
import ProfessionalCardFrame from "@/components/results/ProfessionalCardFrame";
import { buildProfessionalDecisionConfidence } from "../../../shared/professionalRecommendation.js";

// Cardul de rezultat pentru un specialist (recomandarile clientului).
//
// 2026-09-03. Ce difera fata de cardul unei locatii este continutul, pentru ca intrebarea e alta:
//   - locatia raspunde "ce se face aici si cand e deschis";
//   - specialistul raspunde "ce declara ca face si unde poate fi gasit".
// De aceea aici nu exista program, disponibilitate sau distanta - VIASEE nu detine programul
// personal al nimanui, iar a-l sugera vizual ar fi o afirmatie pe care nu o putem sustine.
//
// 2026-09-30. Cardul foloseste acelasi cadru ca in tabul „Specialisti” de pe /cauta si aceeasi
// grila ca recomandarile de locatii (ProfessionalCardFrame). Dispar chenarele de varianta (Top 3
// evidentiat, director punctat), ca la locatii: distinctia ramane in titlurile sectiunilor, iar
// varianta, primita strict din `result_bucket`, se pune doar ca `data-result-variant`. Panoul „De ce
// se potriveste” este mereu in forma compacta, ca la locatii (celulele grilei sunt inguste).

const TIER_LABELS = {
  apropiere: "În zona ta",
  oras: "În localitatea aleasă",
  judet: "În județ",
  tara: "În alt oraș din România",
  national: "În alt oraș din România",
};

export default function ProfessionalResultCard({
  professional,
  variant = "neutral",
  onProfileClick,
  onLocationClick,
  needLevel = "general",
}) {
  const route = useLocation();
  const returnState = route.pathname === "/rezultate"
    ? { resultsReturn: route.state }
    : undefined;
  const locations = Array.isArray(professional.locations) ? professional.locations : [];

  const matchedLabels = Array.isArray(professional.matched_specialization_labels) && professional.matched_specialization_labels.length > 0
    ? professional.matched_specialization_labels
    : (professional.specialization_labels || []);

  const confidence = buildProfessionalDecisionConfidence({
    professionalType: professional.professional_type,
    matchedSpecializations: professional.matched_specializations || [],
    matchedServiceKeys: professional.matched_service_keys || [],
    bestLocationTrust: professional.best_location_trust || "directory",
    publicLocationCount: Number(professional.public_location_count) || locations.length,
    needLevel,
  });
  const tier = TIER_LABELS[professional.expansion_tier];

  return (
    <ProfessionalCardFrame
      professional={professional}
      variant={variant}
      specializations={matchedLabels}
      linkState={returnState}
      onProfileClick={onProfileClick}
      onLocationClick={onLocationClick}
      details={(
        <>
          {tier && (
            <p className="mt-2.5 text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-card px-2 py-0.5">{tier}</span>
            </p>
          )}
          <DecisionConfidencePanel confidence={confidence} compact />
        </>
      )}
    />
  );
}
