import React, { useState } from "react";
import ResearchQueue from "./research/ResearchQueue";
import ResearchProfile from "./research/ResearchProfile";
import ResearchCoverage from "./research/ResearchCoverage";
import ResearchCsvTemplate from "./research/ResearchCsvTemplate";
import AICopilot from "./research/AICopilot";
import AdminCard from "../ui/AdminCard";

const VIEWS = [
  { key: "queue", label: "Coada de research" },
  { key: "ai", label: "AI Copilot" },
  { key: "coverage", label: "Acoperire" },
  { key: "csv", label: "Sablon CSV" },
];

export default function DirResearch({ onNavigate }) {
  const [view, setView] = useState("queue");
  const [selectedId, setSelectedId] = useState(null);

  if (selectedId) {
    return <ResearchProfile locationId={selectedId} onBack={() => setSelectedId(null)} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-5">
      <AdminCard className="inline-flex flex-wrap gap-1 p-2">
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              view === item.key
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </AdminCard>

      {view === "queue" && <ResearchQueue onOpen={setSelectedId} />}
      {view === "ai" && <AICopilot onNavigate={onNavigate} />}
      {view === "coverage" && <ResearchCoverage />}
      {view === "csv" && <ResearchCsvTemplate />}
    </div>
  );
}
