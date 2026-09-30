import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import "@/index.css";
import ProfessionalDirectoryCard from "@/components/results/ProfessionalDirectoryCard";
import ProfessionalMatchResultCard from "@/components/intake2/ProfessionalMatchResultCard";
import DirectoryResultCard from "@/components/results/DirectoryResultCard";
import ServiceMatchDetails from "@/components/results/ServiceMatchDetails";
import { resultGridClassName, resultCellClassName } from "@/components/results/resultGridClasses";

const svg = (c1, c2) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='400' height='500' fill='url(#g)'/><circle cx='200' cy='170' r='70' fill='#fff' opacity='.7'/><rect x='110' y='260' width='180' height='200' rx='90' fill='#fff' opacity='.7'/></svg>`)}`;

const locs = [
  { id: "l1", name: "Clinica Vision Cluj", city: "Cluj-Napoca", organization_name: "Vision SRL" },
  { id: "l2", name: "Centrul Medical Review Moților", city: "Cluj-Napoca", organization_name: "Review" },
  { id: "l3", name: "Optica Avantaj", city: "Florești", organization_name: "Avantaj" },
];
const pros = [
  { id: "p1", display_name: "Dr. Andreea Popescu", professional_type: "ophthalmologist", professional_type_label: "Medic oftalmolog", specialization_labels: ["Oftalmologie generală", "Glaucom", "Retină", "Cataractă"], locations: locs, result_bucket: "top3", bucket_rank: 1, expansion_tier: "oras", matched_specializations: ["glaucoma"], matched_specialization_labels: ["Glaucom", "Oftalmologie generală"], best_location_trust: "claimed", public_location_count: 3 },
  { id: "p2", display_name: "Mihai Ionescu", professional_type: "optometrist", professional_type_label: "Optometrist", profile_photo_url: svg("#dfe8e1", "#9fb7a7"), specialization_labels: ["Refracție", "Lentile de contact"], locations: locs.slice(0, 1), result_bucket: "extended_confirmed", bucket_rank: 4, expansion_tier: "judet", matched_specializations: [], best_location_trust: "directory", public_location_count: 1 },
  { id: "p3", display_name: "Ana-Maria Constantinescu-Vasilescu Popa", professional_type: "optician", professional_type_label: "Optician", specialization_labels: [], locations: locs.slice(0, 2), result_bucket: "extended_directory", bucket_rank: 9, expansion_tier: "national", matched_specializations: [], best_location_trust: "directory", public_location_count: 2 },
];
const places = [
  { id: "a1", name: "Avantaj Optik Cluj-Napoca", provider_type: "optica_medicala", city: "Cluj-Napoca", address: "Str. Napoca nr. 7", phone: "0264123456", profile_control_status: "directory", expansion_tier: "oras", availability_label: "Deschis acum" },
  { id: "a2", name: "Clinica Oftalmologică Prof. Dr. Ion Popescu și Asociații", provider_type: "clinica_oftalmologica", city: "Cluj-Napoca", address: "Str. Moților nr. 9, ap. 7, Cluj-Napoca", phone: "0264123457", profile_control_status: "verified", photo_url: svg("#e9e2d3", "#b9a98a"), logo_url: svg("#ffffff", "#dce4f2"), expansion_tier: "oras" },
  { id: "a3", name: "Cabinet Ofta Cluj", provider_type: "cabinet_oftalmologic", city: "Cluj-Napoca", address: "", profile_control_status: "claimed", expansion_tier: "judet" },
];

const params = new URLSearchParams(location.search);
const which = params.get("v") || "all";

function Section({ title, children }) {
  return <section style={{ padding: "8px 16px" }}><h2 style={{ font: "700 13px sans-serif", margin: "8px 0", color: "#666" }}>{title}</h2>{children}</section>;
}

function App() {
  return (
    <MemoryRouter initialEntries={["/rezultate"]}>
      {(which === "all" || which === "browse") && (
        <Section title="BROWSE specialisti (/cauta)">
          <div className={resultGridClassName(false)}>{pros.map((p) => <ProfessionalDirectoryCard key={p.id} professional={p} />)}</div>
        </Section>
      )}
      {(which === "all" || which === "recs") && (
        <Section title="RECS specialisti (/rezultate)">
          <div className={resultGridClassName(false)}>{pros.map((p) => <ProfessionalMatchResultCard key={p.id} professional={p} />)}</div>
        </Section>
      )}
      {(which === "all" || which === "beside") && (
        <Section title="LOCATII langa harta (compact de la lg)">
          <div className={resultGridClassName(true)}>
            {places.map((l, i) => (
              <div key={l.id} data-selected={i === 1 ? "" : undefined} className={resultCellClassName({ hasPositions: true, selected: i === 1 })}>
                <DirectoryResultCard location={l} rank={i + 1} onShowMap={() => {}} distanceKm={i === 0 ? 0.4 : null} details={i < 2 ? <ServiceMatchDetails location={l} /> : null} />
              </div>
            ))}
          </div>
        </Section>
      )}
      {(which === "all" || which === "nomap") && (
        <Section title="LOCATII fara harta (vertical)">
          <div className={resultGridClassName(false)}>
            {places.map((l) => <div key={l.id} className={resultCellClassName({ hasPositions: false })}><DirectoryResultCard location={l} onShowMap={() => {}} /></div>)}
          </div>
        </Section>
      )}
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")).render(<App />);
