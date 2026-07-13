import React, { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminClaimIdentityContext from "@/components/admin/AdminClaimIdentityContext";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

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

  return (
    <AdminCard className="p-5">
      {!claims && <p className="text-muted-foreground text-sm">Se incarca...</p>}
      {claims && claims.length === 0 && (
        <EmptyState icon={FileCheck2} title="Nicio revendicare in asteptare." subtitle="Cererile de revendicare a profilurilor vor aparea aici." />
      )}
      {claims && claims.length > 0 && (
        <div className="space-y-2">
          {claims.map((c) => {
            const loc = locations[c.location_id];
            // Module 3H.1B.2: duplicate-review requests have no location and are never approvable here.
            const isDuplicateReview = c.mode === "new_location_duplicate_review";
            const modeLabel = isDuplicateReview ? "locatie noua — verificare duplicat" : c.mode || "claim";
            return (
              <div key={c.id} className="bg-secondary/50 border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <div className="font-semibold text-sm">{c.business_name || loc?.name || "Fara nume"}</div>
                    <div className="text-xs text-muted-foreground">
                      {loc ? `${loc.name}, ${loc.city}` : isDuplicateReview ? "propunere de locatie (necreata)" : "locatie noua / necunoscuta"} · {c.contact_name} · {c.email}{c.phone ? ` · ${c.phone}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Mod: {modeLabel} · Reprezentare confirmata: {c.representation_confirmed ? "da" : "nu"}{c.review_notes ? ` · Nota: ${c.review_notes}` : ""}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.status === "aprobata" ? "bg-green-100 text-green-800" : c.status === "respinsa" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{c.status}</span>
                  {c.status === "in_asteptare" && (
                    <div className="flex gap-2">
                      {!isDuplicateReview && (
                        <button onClick={() => setAction({ claimId: c.id, type: "approve" })} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold">Aproba</button>
                      )}
                      <button onClick={() => setAction({ claimId: c.id, type: "reject" })} className="text-xs px-3 py-1.5 rounded-md bg-card border border-border text-destructive">Respinge</button>
                    </div>
                  )}
                </div>
                <AdminClaimIdentityContext claim={c} />
                {isDuplicateReview && c.status === "in_asteptare" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nicio locatie nu a fost creata. Daca este cu adevarat distincta, creeaz-o doar prin fluxul canonic „Adauga locatie", apoi inchide cererea cu o nota.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {action && (
        <DirOpsActionNote
          title={action.type === "approve" ? "Aprobare revendicare (serviciile NU se confirma automat)" : "Respingere revendicare — nota obligatorie"}
          noteOptional={action.type === "approve"}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
    </AdminCard>
  );
}