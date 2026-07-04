import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";

export default function DirOpsClaims() {
  const [claims, setClaims] = useState(null);
  const [locations, setLocations] = useState({});
  const [action, setAction] = useState(null); // { claimId, type }

  const load = async () => {
    const [cls, locs] = await Promise.all([
      base44.entities.ProviderClaimRequest.list("-created_date", 200),
      base44.entities.ProviderLocation.list(null, 500),
    ]);
    setClaims(cls);
    setLocations(Object.fromEntries(locs.map((l) => [l.id, l])));
  };
  useEffect(() => { load(); }, []);

  const run = async (note) => {
    await base44.functions.invoke("directoryOps", {
      action: action.type === "approve" ? "approve_claim" : "reject_claim",
      claim_id: action.claimId,
      note,
    });
    setAction(null);
    load();
  };

  if (!claims) return <p className="text-muted-foreground text-sm">Se incarca...</p>;
  if (claims.length === 0) return <p className="text-muted-foreground text-sm">Nicio revendicare.</p>;

  return (
    <div className="space-y-2">
      {claims.map((c) => {
        const loc = locations[c.location_id];
        return (
          <div key={c.id} className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <div className="font-semibold text-sm">{c.business_name || loc?.name || "Fara nume"}</div>
              <div className="text-xs text-muted-foreground">
                {loc ? `${loc.name}, ${loc.city}` : "locatie noua / necunoscuta"} · {c.contact_name} · {c.email}{c.phone ? ` · ${c.phone}` : ""}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Mod: {c.mode || "claim"} · Reprezentare confirmata: {c.representation_confirmed ? "da" : "nu"}{c.review_notes ? ` · Nota: ${c.review_notes}` : ""}</div>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.status === "aprobata" ? "bg-green-100 text-green-800" : c.status === "respinsa" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{c.status}</span>
            {c.status === "in_asteptare" && (
              <div className="flex gap-2">
                <button onClick={() => setAction({ claimId: c.id, type: "approve" })} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold">Aproba</button>
                <button onClick={() => setAction({ claimId: c.id, type: "reject" })} className="text-xs px-3 py-1.5 rounded-md bg-secondary text-destructive">Respinge</button>
              </div>
            )}
          </div>
        );
      })}
      {action && (
        <DirOpsActionNote
          title={action.type === "approve" ? "Aprobare revendicare (serviciile NU se confirma automat)" : "Respingere revendicare — nota obligatorie"}
          noteOptional={action.type === "approve"}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
}