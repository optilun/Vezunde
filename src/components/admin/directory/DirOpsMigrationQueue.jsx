import React, { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PCS_LABELS, CONFIRMATION_LABELS } from "@/lib/directoryOpsCatalog";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

export default function DirOpsMigrationQueue() {
  const [items, setItems] = useState(null);
  const [action, setAction] = useState(null); // { item, decision }

  const load = async () => {
    const [locs, svcs, claims] = await Promise.all([
      base44.entities.ProviderLocation.filter({ migration_review_required: true }, null, 200),
      base44.entities.LocationService.filter({ migration_review_required: true }, null, 500),
      base44.entities.ProviderClaimRequest.list(null, 200),
    ]);
    const allLocs = await base44.entities.ProviderLocation.list(null, 500);
    const locMap = Object.fromEntries(allLocs.map((l) => [l.id, l]));
    setItems([
      ...locs.map((l) => ({ kind: "location", id: l.id, rec: l, loc: l, claims: claims.filter((c) => c.location_id === l.id) })),
      ...svcs.map((s) => ({ kind: "service", id: s.id, rec: s, loc: locMap[s.location_id], claims: claims.filter((c) => c.location_id === s.location_id) })),
    ]);
  };
  useEffect(() => { load(); }, []);

  const run = async (note) => {
    const { item, decision } = action;
    await base44.functions.invoke("directoryOps", item.kind === "location"
      ? { action: "resolve_location_review", location_id: item.id, decision, note }
      : { action: "resolve_service_review", service_id: item.id, decision, note });
    setAction(null);
    load();
  };

  return (
    <AdminCard className="p-5">
      {!items && <p className="text-muted-foreground text-sm">Se incarca...</p>}
      {items && items.length === 0 && (
        <EmptyState icon={ListChecks} title="Nicio inregistrare in coada de review migrare." subtitle="Elementele care necesita confirmare dupa migrare vor aparea aici." />
      )}
      <div className="space-y-3">
      {items?.map((item) => (
        <div key={`${item.kind}-${item.id}`} className="bg-secondary/50 border border-border rounded-xl p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[240px]">
              <div className="text-xs font-semibold uppercase text-muted-foreground">{item.kind === "location" ? "Locatie" : "Serviciu"}</div>
              <div className="font-semibold text-sm mt-0.5">
                {item.kind === "location" ? item.rec.name : `${item.rec.service_key} — ${item.loc?.name || "locatie necunoscuta"}`}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {item.kind === "location" ? (
                  <>Status: {PCS_LABELS[item.rec.profile_control_status || "directory"]} · Revendicare: {item.rec.claim_verification_status || "none"} · Legacy: is_verified={String(!!item.rec.is_verified)}, verification_state={item.rec.verification_state || "-"}</>
                ) : (
                  <>Nivel: {CONFIRMATION_LABELS[item.rec.confirmation_level] || item.rec.confirmation_level} · matching {item.rec.matching_allowed ? "permis" : "blocat"} · nevoie: {item.rec.service_need_level || "general"}</>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Sursa: {(item.kind === "location" ? item.rec.source_url : item.rec.service_source_url) || "lipsa"}
                {item.claims.length > 0 && <span className="ml-2">Revendicari: {item.claims.map((c) => c.status).join(", ")}</span>}
              </div>
              <div className="text-xs text-destructive mt-1">Motiv flag: date migrate fara dovada explicita de confirmare</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.kind === "location" ? (
                <>
                  <button onClick={() => setAction({ item, decision: "keep_directory" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent">Pastreaza directory</button>
                  <button onClick={() => setAction({ item, decision: "suspend" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent text-destructive">Suspenda</button>
                  <button onClick={() => setAction({ item, decision: "resolve_flag" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent">Rezolva flag</button>
                </>
              ) : (
                <>
                  <button onClick={() => setAction({ item, decision: "keep_not_confirmed" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent">Pastreaza neconfirmat</button>
                  <button onClick={() => setAction({ item, decision: "resolve_flag" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-accent">Rezolva flag</button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
      </div>
      {action && (
        <DirOpsActionNote title="Decizie review migrare — nota obligatorie" onConfirm={run} onCancel={() => setAction(null)} />
      )}
    </AdminCard>
  );
}