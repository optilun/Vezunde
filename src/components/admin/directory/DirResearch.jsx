import React from "react";
import ResearchQueue from "./research/ResearchQueue";
import ResearchProfile from "./research/ResearchProfile";
import ResearchCoverage from "./research/ResearchCoverage";
import AICopilot from "./research/AICopilot";
import ResearchServiceBatches from "./research/ResearchServiceBatches";
import AdminTabs from "../ui/AdminTabs";
import { useAdminSelectedId, useAdminSubTab } from "@/components/admin/useAdminRoute";

// 2026-09-12: Sablon CSV a devenit buton (arata/ascunde) in Loturi de servicii,
// nu mai e sub-view propriu - se foloseste rar si apartine aceluiasi flux.
// 2026-10-07: sub-tab-ul și profilul deschis sunt în adresă (?t=…&id=…), deci Înapoi și refresh
// rămân în același loc.
const VIEWS = [
  { key: "queue", label: "Coada de research" },
  { key: "ai", label: "AI Copilot" },
  { key: "batches", label: "Loturi de servicii" },
  { key: "coverage", label: "Acoperire" },
];

export default function DirResearch({ onNavigate }) {
  const [view, setView] = useAdminSubTab(VIEWS.map((item) => item.key), "queue");
  const [selectedId, setSelectedId] = useAdminSelectedId();

  if (selectedId) {
    return <ResearchProfile locationId={selectedId} onBack={() => setSelectedId("")} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-5">
      <AdminTabs tabs={VIEWS} value={view} onChange={setView} label="Research director" />

      {view === "queue" && <ResearchQueue onOpen={setSelectedId} />}
      {view === "ai" && <AICopilot onNavigate={onNavigate} />}
      {view === "batches" && <ResearchServiceBatches />}
      {view === "coverage" && <ResearchCoverage />}
    </div>
  );
}
