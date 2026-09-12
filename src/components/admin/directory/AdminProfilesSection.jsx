import React, { useState } from "react";
import DirOpsProfiles from "./DirOpsProfiles";
import DirOpsMigrationQueue from "./DirOpsMigrationQueue";
import AdminCard from "@/components/admin/ui/AdminCard";

export default function AdminProfilesSection({ onNavigate }) {
  const [tab, setTab] = useState("profiluri");

  const tabs = [
    { key: "profiluri", label: "Toate profilurile" },
    { key: "migrare", label: "Review migrare" },
  ];

  return (
    <div className="space-y-5">
      <AdminCard className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold">Profiluri si locatii publicate</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Modificarile trimise de furnizori nu mai sunt procesate din campul legacy pending_changes. Ele apar in Coada de verificare, pe infrastructura ProviderWorkspaceSubmission.
            </p>
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("adauga")}
              className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              + Adauga locatie
            </button>
          )}
        </div>
      </AdminCard>

      <AdminCard className="inline-flex flex-wrap gap-1 p-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === item.key
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </AdminCard>

      <div>
        {tab === "profiluri" && <DirOpsProfiles />}
        {tab === "migrare" && <DirOpsMigrationQueue />}
      </div>
    </div>
  );
}
