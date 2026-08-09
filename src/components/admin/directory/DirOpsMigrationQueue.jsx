import React, { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PCS_LABELS, CONFIRMATION_LABELS } from "@/lib/directoryOpsCatalog";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

export default function DirOpsMigrationQueue() {
  const [items, setItems] = useState(null);
  const [action, setAction] = useState(null);

  const load = async () => {
    const [locations, services, claims] = await Promise.all([
      base44.entities.ProviderLocation.filter({ migration_review_required: true }, null, 200),
      base44.entities.LocationService.filter({ migration_review_required: true }, null, 500),
      base44.entities.ProviderClaimRequest.list(null, 200),
    ]);
    const allLocations = await base44.entities.ProviderLocation.list(null, 5000);
    const locationMap = Object.fromEntries(allLocations.map((location) => [location.id, location]));
    setItems([
      ...locations.map((location) => ({
        kind: "location",
        id: location.id,
        rec: location,
        loc: location,
        claims: claims.filter((claim) => claim.location_id === location.id),
      })),
      ...services.map((service) => ({
        kind: "service",
        id: service.id,
        rec: service,
        loc: locationMap[service.location_id],
        claims: claims.filter((claim) => claim.location_id === service.location_id),
      })),
    ]);
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (note) => {
    const { item, decision } = action;
    await base44.functions.invoke(
      "directoryOps",
      item.kind === "location"
        ? {
            action: "resolve_location_review",
            location_id: item.id,
            decision,
            note,
          }
        : {
            action: "resolve_service_review",
            service_id: item.id,
            decision,
            note,
          },
    );
    setAction(null);
    await load();
  };

  return (
    <AdminCard className="p-4 sm:p-5">
      {!items && <p className="text-sm text-muted-foreground">Se incarca...</p>}

      {items && items.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title="Nicio inregistrare in coada de review migrare."
          subtitle="Elementele care necesita confirmare dupa migrare vor aparea aici."
        />
      )}

      <div className="space-y-3">
        {items?.map((item) => (
          <article
            key={`${item.kind}-${item.id}`}
            className="rounded-2xl border border-border bg-secondary/50 p-3.5 sm:p-4"
          >
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1 sm:min-w-[240px]">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {item.kind === "location" ? "Locatie" : "Serviciu"}
                </div>
                <div className="mt-0.5 break-words text-sm font-semibold">
                  {item.kind === "location"
                    ? item.rec.name
                    : `${item.rec.service_key} — ${item.loc?.name || "locatie necunoscuta"}`}
                </div>
                <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  {item.kind === "location" ? (
                    <>
                      Status: {PCS_LABELS[item.rec.profile_control_status || "directory"]}
                      {" · "}Revendicare: {item.rec.claim_verification_status || "none"}
                      {" · "}Legacy: is_verified={String(Boolean(item.rec.is_verified))}, verification_state={item.rec.verification_state || "-"}
                    </>
                  ) : (
                    <>
                      Nivel: {CONFIRMATION_LABELS[item.rec.confirmation_level] || item.rec.confirmation_level}
                      {" · "}matching {item.rec.matching_allowed ? "permis" : "blocat"}
                      {" · "}nevoie: {item.rec.service_need_level || "general"}
                    </>
                  )}
                </div>
                <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                  Sursa: {item.kind === "location"
                    ? item.rec.source_url || "lipsa"
                    : item.rec.service_source_url || "lipsa"}
                  {item.claims.length > 0 && (
                    <span className="block sm:ml-2 sm:inline">
                      Revendicari: {item.claims.map((claim) => claim.status).join(", ")}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-destructive">
                  Motiv flag: date migrate fara dovada explicita de confirmare
                </div>
              </div>

              <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                {item.kind === "location" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setAction({ item, decision: "keep_directory" })}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-3 text-xs font-semibold hover:bg-accent sm:min-h-10 sm:rounded-md"
                    >
                      Pastreaza directory
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction({ item, decision: "suspend" })}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-3 text-xs font-semibold text-destructive hover:bg-accent sm:min-h-10 sm:rounded-md"
                    >
                      Suspenda
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction({ item, decision: "resolve_flag" })}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-3 text-xs font-semibold hover:bg-accent sm:min-h-10 sm:rounded-md"
                    >
                      Rezolva flag
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAction({ item, decision: "keep_not_confirmed" })}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-3 text-xs font-semibold hover:bg-accent sm:min-h-10 sm:rounded-md"
                    >
                      Pastreaza neconfirmat
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction({ item, decision: "resolve_flag" })}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-3 text-xs font-semibold hover:bg-accent sm:min-h-10 sm:rounded-md"
                    >
                      Rezolva flag
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {action && (
        <DirOpsActionNote
          title="Decizie review migrare — nota obligatorie"
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
    </AdminCard>
  );
}
