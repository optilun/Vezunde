import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { ChevronRight, CheckCircle2 } from "lucide-react";

// UI-1 PART 3.D — operational priority list, real counts only, each links to
// its existing admin section.
export default function ActionQueueCard({ items, onNavigate }) {
  const active = items.filter((i) => i.count > 0);
  return (
    <AdminCard className="p-5">
      <h3 className="font-heading font-bold text-sm">Necesita actiune</h3>
      {active.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nu exista actiuni care necesita atentie acum." />
      ) : (
        <ul className="mt-2 space-y-1">
          {active.map((i) => (
            <li key={i.label}>
              <button onClick={() => onNavigate(i.tab)} className="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-lg hover:bg-secondary transition-colors text-sm">
                <span>{i.label}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <span className="font-semibold text-foreground">{i.count}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}