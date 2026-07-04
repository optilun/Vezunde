import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CONFIRMATION_LABELS } from "@/lib/directoryOpsCatalog";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";

export default function DirOpsServiceRow({ service, location, onChanged }) {
  const [level, setLevel] = useState("");
  const [askNote, setAskNote] = useState(false);

  const apply = async (note) => {
    await base44.functions.invoke("directoryOps", {
      action: "set_service_confirmation",
      service_id: service.id,
      level,
      note,
    });
    setAskNote(false);
    setLevel("");
    onChanged();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[180px]">
        <div className="font-semibold text-sm">{service.service_key}</div>
        <div className="text-xs text-muted-foreground">
          {service.service_need_level || "general"} · {CONFIRMATION_LABELS[service.confirmation_level] || service.confirmation_level} · matching {service.matching_allowed ? "permis" : "blocat"}
          {service.migration_review_required && <span className="ml-2 text-destructive font-semibold">review migrare</span>}
        </div>
        {service.service_source_url && (
          <a href={service.service_source_url} target="_blank" rel="noreferrer" className="text-xs underline text-muted-foreground">{service.service_source_url}</a>
        )}
      </div>
      <select className="border border-input rounded-md px-2 py-1.5 text-xs bg-card" value={level} onChange={(e) => setLevel(e.target.value)}>
        <option value="">Schimba nivel...</option>
        <option value="not_confirmed">Neconfirmat</option>
        <option value="publicly_listed">Listat public</option>
        <option value="provider_confirmed">Confirmat de furnizor</option>
        <option value="vezunde_verified">Verificat Vezunde</option>
      </select>
      <button onClick={() => level && setAskNote(true)} disabled={!level} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent disabled:opacity-40">Aplica</button>
      {askNote && (
        <DirOpsActionNote
          title={`Schimbare nivel serviciu la "${CONFIRMATION_LABELS[level]}" — nota de audit`}
          noteOptional={level === "publicly_listed" || level === "not_confirmed"}
          onConfirm={apply}
          onCancel={() => setAskNote(false)}
        />
      )}
    </div>
  );
}