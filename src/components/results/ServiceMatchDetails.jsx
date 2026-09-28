import React from "react";
import { Clock } from "lucide-react";
import { summarizePublicServices } from "@/lib/servicePresentation";
import { buildProviderDecisionConfidence } from "../../../shared/providerDecisionConfidence.js";
import ServiceChip from "@/components/results/ServiceChip";
import DecisionConfidencePanel from "@/components/results/DecisionConfidencePanel";

// 2026-09-28 (audit /cauta, E1). Detaliile potrivirii pentru o cautare dupa serviciu, afisate in
// acelasi card ca la rasfoirea localitatii (DirectoryResultCard). Inainte, /cauta avea doua stiluri
// de card: cel nou la rasfoire si cardul vechi al recomandarilor la cautarea dupa serviciu.
//
// Continutul este acelasi ca in cardul vechi (ResultCard, varianta compacta): serviciile potrivite,
// disponibilitatea, panoul de incredere construit din aceleasi date si explicatia ariei. Nu se
// calculeaza si nu se reordoneaza nimic aici. Ecranul de recomandari (/rezultate) ramane cu ResultCard.

const TIER_LABELS = {
  apropiere: "În zona ta",
  judet: "În județ",
  national: "În alt oraș din România",
};

function confidenceForLocation(location) {
  return buildProviderDecisionConfidence({
    matchedServiceKeys: location.matched_service_keys || [],
    profileControlStatus: location.profile_control_status || "directory",
    availability: location.availability_label ? { label: location.availability_label } : null,
    expansionTier: location.expansion_tier || "oras",
    professionalCount: Number(location.professional_count) || 0,
    needLevel: location.need_level_snapshot || location.need_level || "general",
  });
}

export default function ServiceMatchDetails({ location }) {
  const allServices = location.public_services || [];
  const matchedServices = location.matched_public_services?.length ? location.matched_public_services : allServices;
  const summaries = summarizePublicServices(matchedServices);
  const shown = summaries.slice(0, 2);
  const extra = Math.max(0, summaries.length - shown.length);
  const tier = TIER_LABELS[location.expansion_tier];

  return (
    <div className="mt-3">
      {(tier || location.availability_label) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {tier && <span className="rounded-full border border-border bg-card px-2 py-0.5">{tier}</span>}
          {location.availability_label && <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-3.5 w-3.5" />{location.availability_label}</span>}
        </p>
      )}
      {shown.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {shown.map((service) => <ServiceChip key={service.key} label={service.label} />)}
          {extra > 0 && <span className="px-1 py-1 text-xs text-muted-foreground">+{extra} servicii</span>}
        </div>
      )}
      <DecisionConfidencePanel confidence={confidenceForLocation(location)} contextLabel="De ce se potriveste" compact />
      {location.routing_reason && (
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-[#4f6080]">Despre aria căutării</summary>
          <p className="pb-2 leading-relaxed">{location.routing_reason}</p>
        </details>
      )}
    </div>
  );
}
