import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import { History } from "lucide-react";
import { auditActionLabel, auditActorLabel, auditActorType, auditEntityLabel } from "@/lib/adminLabels";
import { fullDateTime, relativeTime } from "@/lib/adminFormat";

// Activitate recentă din DirectoryAuditRecord, doar acțiuni ale oamenilor (fără evenimentele de
// sistem în masă), cu aceleași etichete ca în Istoric audit și timp relativ. `records`: null = se
// încarcă, "error" = indisponibil.
export default function RecentActivityCard({ records, currentEmail, onNavigate }) {
  const rows = Array.isArray(records) ? records : [];
  return (
    <AdminCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-bold">Activitate recentă</h3>
        {rows.length > 0 && (
          <button type="button" onClick={() => onNavigate("audit")} className="text-xs text-muted-foreground hover:text-foreground">
            Vezi tot
          </button>
        )}
      </div>
      {records === null && <div className="mt-3"><AdminLoading label="Se încarcă activitatea…" rows={3} /></div>}
      {records === "error" && (
        <p className="mt-3 text-xs text-muted-foreground">Activitatea nu s-a putut încărca acum.</p>
      )}
      {Array.isArray(records) && rows.length === 0 && (
        <EmptyState icon={History} title="Nicio activitate încă." />
      )}
      {rows.length > 0 && (
        <ul className="mt-3 space-y-3">
          {rows.slice(0, 6).map((record) => {
            const mine = currentEmail && record.admin_email && record.admin_email.toLowerCase() === currentEmail.toLowerCase();
            const actor = mine ? "Tu" : auditActorLabel(record);
            return (
              <li key={record.id} className="text-xs">
                <p>
                  <span className="font-semibold">{auditActionLabel(record.action_type)}</span>{" "}
                  <span className="text-muted-foreground">· {auditEntityLabel(record.entity_type)}</span>
                </p>
                <p className="mt-0.5 text-muted-foreground" title={fullDateTime(record.performed_at || record.created_date)}>
                  {auditActorType(record) === "provider" && !mine ? "Furnizor" : actor} · {relativeTime(record.performed_at || record.created_date)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </AdminCard>
  );
}
