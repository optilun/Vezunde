import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PCS_LABELS } from "@/lib/directoryOpsCatalog";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";

export default function DirOpsProfiles() {
  const [locations, setLocations] = useState(null);
  const [action, setAction] = useState(null); // { locationId, type }

  const load = () => base44.entities.ProviderLocation.list("-updated_date", 300).then(setLocations);
  useEffect(() => { load(); }, []);

  const run = async (note) => {
    await base44.functions.invoke("directoryOps", {
      action: action.type === "verify" ? "verify_profile" : "suspend_profile",
      location_id: action.locationId,
      note,
    });
    setAction(null);
    load();
  };

  if (!locations) return <p className="text-muted-foreground text-sm">Se incarca...</p>;

  return (
    <div className="space-y-2">
      {locations.map((l) => {
        const pcs = l.profile_control_status || "directory";
        return (
          <div key={l.id} className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="font-semibold text-sm">{l.name}</div>
              <div className="text-xs text-muted-foreground">{l.city}{l.county ? `, ${l.county}` : ""} · {l.provider_type} · {l.active_status || "activa"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Sursa: {l.source_url ? <a href={l.source_url} target="_blank" rel="noreferrer" className="underline">{l.source_url}</a> : "lipsa"}
                {l.migration_review_required && <span className="ml-2 text-destructive font-semibold">necesita review migrare</span>}
              </div>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${pcs === "verified" ? "bg-green-100 text-green-800" : pcs === "claimed" ? "bg-blue-100 text-blue-800" : pcs === "suspended" ? "bg-red-100 text-red-800" : "bg-secondary text-foreground"}`}>
              {PCS_LABELS[pcs]}
            </span>
            <div className="flex gap-2">
              {pcs !== "verified" && (
                <button onClick={() => setAction({ locationId: l.id, type: "verify" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent">Verifica profil</button>
              )}
              {pcs !== "suspended" && (
                <button onClick={() => setAction({ locationId: l.id, type: "suspend" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-destructive">Suspenda</button>
              )}
            </div>
          </div>
        );
      })}
      {action && (
        <DirOpsActionNote
          title={action.type === "verify" ? "Verificare profil — nota obligatorie" : "Suspendare profil — nota obligatorie"}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
}