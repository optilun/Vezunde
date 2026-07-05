import React, { useState } from "react";
import ResearchQueue from "./research/ResearchQueue";
import ResearchProfile from "./research/ResearchProfile";
import ResearchCoverage from "./research/ResearchCoverage";
import ResearchCsvTemplate from "./research/ResearchCsvTemplate";
import GeoImport from "./research/GeoImport";
import AICopilot from "./research/AICopilot";
import AdminCard from "../ui/AdminCard";
import AdminPageHeader from "../ui/AdminPageHeader";

// MODULE 3F / 3H.1E - "Research director": internal, admin-only research workflow, card-based layout.
const VIEWS = [
  { key: "queue", label: "Coada de research" },
  { key: "ai", label: "AI Copilot" },
  { key: "coverage", label: "Acoperire" },
  { key: "csv", label: "Sablon CSV" },
  { key: "geo", label: "Geografie Romania" },
];

export default function DirResearch({ onNavigate }) {
  const [view, setView] = useState("queue");
  const [selectedId, setSelectedId] = useState(null);

  if (selectedId) {
    return <ResearchProfile locationId={selectedId} onBack={() => setSelectedId(null)} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-5">
      <AdminCard className="p-5">
        <AdminPageHeader title="Research director" subtitle="Coordoneaza verificarea si completarea profilurilor furnizorilor din director." />
      </AdminCard>

      <AdminCard className="p-2 inline-flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === v.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {v.label}
          </button>
        ))}
      </AdminCard>

      {view === "queue" && <ResearchQueue onOpen={setSelectedId} />}
      {view === "ai" && <AICopilot onNavigate={onNavigate} />}
      {view === "coverage" && <ResearchCoverage />}
      {view === "csv" && <ResearchCsvTemplate />}
      {view === "geo" && <GeoImport />}
    </div>
  );
}