import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";
import ServiceMatchDetails from "@/components/results/ServiceMatchDetails";
import DirectoryProfileNotice from "@/components/provider/DirectoryProfileNotice";
import { resultCellClassName } from "@/components/results/resultGridClasses";
import { mapPointFromResult } from "../../../shared/resultsMapPoints.js";
import { requestMapCardFocus } from "@/lib/mapCardFocus";
import { base44 } from "@/api/base44Client";

// Cardul unei recomandari.
//
// 2026-09-30. Recomandarile clientului folosesc acum acelasi card ca /cauta (DirectoryResultCard:
// coperta, numele, adresa, starea profilului, sageata spre profil), in aceeasi grila. Inainte
// aveau un card propriu (ResultCard), cu miniatura, insigna si butoane, si pacientul vedea doua
// stiluri pentru aceleasi locatii.
//
// Ce NU s-a schimbat: bucketul si numarul din Top 3 vin de la server (`result_bucket`,
// `bucket_rank`) si sunt redate ca atare - nu se calculeaza, nu se reordoneaza si nu se filtreaza
// nimic aici. Ramase la fel: analitica (profile_opened / phone_clicked), distanta, panoul „De ce
// se potriveste” (prin ServiceMatchDetails), notita de profil din director (pliata), starea de
// intoarcere spre /rezultate si legatura cu harta (selectie, hover, „Arata pe harta”).

// Module UI-1: variant is derived strictly from the existing result_bucket
// value returned by matchProviders — never recomputed or overridden here.
// Varianta decide doar daca cardul poarta numarul din Top 3.
const BUCKET_VARIANT = {
  top3: "top3",
  extended_confirmed: "confirmed",
  extended_directory: "directory",
  // Profil din director fara servicii declarate: acelasi tratament vizual ca directory,
  // avertismentul suplimentar este afisat la nivel de sectiune in MatchResults.
  structural_directory: "directory",
};

// Notita de profil nerevendicat spune ceva important - ca datele vin din surse publice, nu de la
// furnizor - dar in lista repeta acelasi text la fiecare card. Ramane la un click distanta, cu
// eticheta care spune exact ce se deschide.
function DirectoryNoticeToggle({ location }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {open ? "Ascunde sursa datelor" : "De unde vin datele acestui profil"}
      </button>
      {open && (
        <div className="mt-1 pb-2">
          <DirectoryProfileNotice location={location} compact />
        </div>
      )}
    </div>
  );
}

export default function MatchResultCard({ location, onSelect, onHover = null, selected = false, hovered = false, hasMapPoint, gridHasMap = false }) {
  const route = useLocation();
  const returnState = route.pathname === "/rezultate" ? { resultsReturn: route.state } : undefined;
  const variant = BUCKET_VARIANT[location.result_bucket] || "neutral";
  const isDirectoryProfile = location.profile_control_status === "directory";
  // Numarul din Top 3: `bucket_rank` primit de la server, redat ca atare.
  const rank = variant === "top3" ? Number(location.bucket_rank) || null : null;
  const hasDistance = !isDirectoryProfile && location.distance_km != null && location.distance_km !== "" && Number.isFinite(Number(location.distance_km));
  const canShowOnMap = Boolean(onSelect) && (hasMapPoint ?? Boolean(mapPointFromResult(location)));

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
    <div
      data-result-location-id={location.id}
      data-selected={selected ? "" : undefined}
      onMouseEnter={onHover ? () => onHover(location.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(location.id) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
      className={resultCellClassName({ hasPositions: gridHasMap, selected, hovered })}
    >
      <DirectoryResultCard
        location={location}
        rank={rank}
        rankKind="recommendation"
        distanceKm={hasDistance ? Number(location.distance_km) : null}
        onShowMap={canShowOnMap ? () => { requestMapCardFocus(); onSelect(location); } : undefined}
        linkState={returnState}
        onProfileClick={() => trackAction("profile_opened")}
        onPhoneClick={() => trackAction("phone_clicked")}
        details={(
          <>
            <ServiceMatchDetails location={location} />
            {isDirectoryProfile && <DirectoryNoticeToggle location={location} />}
          </>
        )}
      />
    </div>
  );
}
