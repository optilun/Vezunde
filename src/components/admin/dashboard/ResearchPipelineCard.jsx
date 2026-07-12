import React from "react";
import { Sparkles } from "lucide-react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

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
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-sm font-bold">Research pipeline</h3>
        {total > 0 && (
          <button type="button" onClick={() => onNavigate("research")} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Deschide
          </button>
        )}
      </div>
      {total === 0 ? (
        <EmptyState
          title="Inca nu exista surse sau drafturi de research."
          ctaLabel="Deschide Research director"
          onCta={() => onNavigate("research")}
          icon={Sparkles}
        />
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}
