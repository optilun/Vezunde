import React, { useEffect, useState } from "react";
import { History } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

export default function DirOpsAudit() {
  const [records, setRecords] = useState(null);

  useEffect(() => {
    base44.entities.DirectoryAuditRecord.list("-created_date", 200).then(setRecords);
  }, []);

  return (
    <AdminCard className="p-5">
      {!records && <p className="text-muted-foreground text-sm">Se incarca...</p>}
      {records && records.length === 0 && (
        <EmptyState icon={History} title="Niciun eveniment de audit inregistrat inca." subtitle="Actiunile administrative vor fi inregistrate aici pe masura ce au loc." />
      )}
      {records && records.length > 0 && (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.id} className="bg-secondary/50 border border-border rounded-xl p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.action_type}</span>
                <span className="text-xs text-muted-foreground">{r.entity_type} · {r.entity_id}</span>
                <span className="text-xs text-muted-foreground ml-auto">{r.performed_at ? new Date(r.performed_at).toLocaleString("ro-RO") : ""} · {r.admin_email}</span>
              </div>
              {r.note && <div className="text-xs mt-1">Nota: {r.note}</div>}
              {r.changed_fields?.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">Campuri: {r.changed_fields.join(", ")}</div>
              )}
              {r.new_values && r.new_values !== "{}" && (
                <div className="text-xs text-muted-foreground mt-1 break-all">Valori noi: {r.new_values}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}