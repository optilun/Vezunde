import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { Sparkles } from "lucide-react";

// UI-1 PART 3.A — real research pipeline counts only.
export default function ResearchPipelineCard({ pipeline, onNavigate }) {
  const total = pipeline.sources + pipeline.drafts;
  const rows = [
    { label: "Surse", value: pipeline.sources },
    { label: "Drafturi AI", value: pipeline.drafts },
    { label: "In review", value: pipeline.inReview },
    { label: "Gata de transfer", value: pipeline.readyToTransfer },
    { label: "Respinse", value: pipeline.rejected },
  ];

  return (
    <AdminCard className="p-5">
      <h3 className="font-heading font-bold text-sm">Research pipeline</h3>
      {total === 0 ? (
        <EmptyState title="Inca nu exista surse sau drafturi de research." ctaLabel="Deschide AI Copilot" onCta={() => onNavigate("ai")} icon={Sparkles} />
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}