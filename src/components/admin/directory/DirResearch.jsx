import React, { useState } from "react";
import ResearchQueue from "./research/ResearchQueue";
import ResearchProfile from "./research/ResearchProfile";
import ResearchCoverage from "./research/ResearchCoverage";
import AICopilot from "./research/AICopilot";
import ResearchServiceBatches from "./research/ResearchServiceBatches";
import AdminCard from "../ui/AdminCard";

// 2026-09-12: Sablon CSV a devenit buton (arata/ascunde) in Loturi de servicii,
// nu mai e sub-view propriu - se foloseste rar si apartine aceluiasi flux.
const VIEWS = [
  { key: "queue", label: "Coada de research" },
  { key: "ai", label: "AI Copilot" },
  { key: "batches", label: "Loturi de servicii" },
  { key: "coverage", label: "Acoperire" },
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
      {view === "batches" && <ResearchServiceBatches />}
      {view === "coverage" && <ResearchCoverage />}
    </div>
  );
}
