import React, { useState } from "react";
import ResearchQueue from "./research/ResearchQueue";
import ResearchProfile from "./research/ResearchProfile";
import ResearchCoverage from "./research/ResearchCoverage";
import ResearchCsvTemplate from "./research/ResearchCsvTemplate";
import GeoImport from "./research/GeoImport";
import AICopilot from "./research/AICopilot";

// MODULE 3F - "Research director": internal, admin-only research workflow.
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
    <div>
      <div className="flex flex-wrap gap-2 mb-5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === v.key ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "queue" && <ResearchQueue onOpen={setSelectedId} />}
      {view === "ai" && <AICopilot onNavigate={onNavigate} />}
      {view === "coverage" && <ResearchCoverage />}
      {view === "csv" && <ResearchCsvTemplate />}
      {view === "geo" && <GeoImport />}
    </div>
  );
}