import React, { useState } from "react";
import DirOpsProfiles from "./DirOpsProfiles";
import DirOpsMigrationQueue from "./DirOpsMigrationQueue";
import AdminCard from "@/components/admin/ui/AdminCard";

export default function AdminProfilesSection() {
  const [tab, setTab] = useState("profiluri");

  const tabs = [
    { key: "profiluri", label: "Toate profilurile" },
    { key: "migrare", label: "Review migrare" },
  ];

  return (
    <div className="space-y-5">
      <AdminCard className="p-4">
        <div className="text-sm font-bold">Profiluri si locatii publicate</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Modificarile trimise de furnizori nu mai sunt procesate din campul legacy pending_changes. Ele apar in Coada de verificare, pe infrastructura ProviderWorkspaceSubmission.
        </p>
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
