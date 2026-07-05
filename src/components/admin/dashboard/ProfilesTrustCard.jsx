import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { PCS_LABELS } from "@/lib/directoryOpsCatalog";

const ORDER = ["directory", "claimed", "verified", "suspended"];
const TONE = { directory: "bg-secondary", claimed: "bg-blue-400", verified: "bg-green-500", suspended: "bg-red-400" };

// UI-1 PART 3.B — profile status distribution as a segmented bar (real counts only).
export default function ProfilesTrustCard({ counts, total }) {
  return (
    <AdminCard className="p-5">
      <h3 className="font-heading font-bold text-sm">Profiluri si incredere</h3>
      {total === 0 ? (
        <EmptyState title="Nu exista inca profiluri de directory." subtitle="Directorul este pregatit pentru primele profiluri reale." />
      ) : (
        <>
          <div className="mt-3 flex h-2.5 rounded-full overflow-hidden bg-secondary">
            {ORDER.map((k) => (counts[k] > 0 ? <div key={k} className={TONE[k]} style={{ width: `${(counts[k] / total) * 100}%` }} /> : null))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ORDER.map((k) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${TONE[k]}`} />
                <span className="text-muted-foreground">{PCS_LABELS[k]}</span>
                <span className="font-semibold ml-auto">{counts[k] || 0}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminCard>
  );
}