import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { History } from "lucide-react";

// UI-1 PART 3.E — recent activity from DirectoryAuditRecord only, no invented rows.
export default function RecentActivityCard({ records, onNavigate }) {
  return (
    <AdminCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-sm">Activitate recenta</h3>
        {records.length > 0 && <button onClick={() => onNavigate("audit")} className="text-xs text-muted-foreground hover:text-foreground">Vezi tot</button>}
      </div>
      {records.length === 0 ? (
        <EmptyState icon={History} title="Nu exista activitate recenta in director." />
      ) : (
        <ul className="mt-3 space-y-3">
          {records.slice(0, 6).map((r) => (
            <li key={r.id} className="text-xs">
              <p><span className="font-semibold">{r.admin_email || "admin"}</span> — {r.action_type} <span className="text-muted-foreground">{r.entity_type}</span></p>
              <p className="text-muted-foreground mt-0.5">{r.performed_at ? new Date(r.performed_at).toLocaleString("ro-RO") : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}