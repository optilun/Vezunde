import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export default function DirOpsAudit() {
  const [records, setRecords] = useState(null);

  useEffect(() => {
    base44.entities.DirectoryAuditRecord.list("-created_date", 200).then(setRecords);
  }, []);

  if (!records) return <p className="text-muted-foreground text-sm">Se incarca...</p>;
  if (records.length === 0) return <p className="text-muted-foreground text-sm">Niciun eveniment de audit inregistrat inca.</p>;

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r.id} className="bg-card border border-border rounded-lg p-3 text-sm">
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
  );
}