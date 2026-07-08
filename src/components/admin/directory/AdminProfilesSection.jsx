import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DirOpsProfiles from "./DirOpsProfiles";
import DirOpsMigrationQueue from "./DirOpsMigrationQueue";
import AdminProfileChangesReview from "./AdminProfileChangesReview";
import AdminCard from "@/components/admin/ui/AdminCard";

// UI-1 / UI-1.1E: keeps the existing Profiluri + Review migrare tabs and adds
// the provider-submitted profile changes queue as a first-class admin review tab.
export default function AdminProfilesSection() {
  const [tab, setTab] = useState("profiluri");
  const [pendingChangesCount, setPendingChangesCount] = useState(0);

  useEffect(() => {
    base44.entities.ProviderLocation.list("name", 500).then((rows) => {
      const count = rows.filter((l) => !!l.pending_changes).length;
      setPendingChangesCount(count);
      if (count > 0) setTab("modificari");
    }).catch(() => {});
  }, []);

  const tabs = [
    { key: "modificari", label: `Modificari in review${pendingChangesCount ? ` (${pendingChangesCount})` : ""}` },
    { key: "profiluri", label: "Toate profilurile" },
    { key: "migrare", label: "Review migrare" },
  ];

  return (
    <div className="space-y-5">
      <AdminCard className="p-2 inline-flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </AdminCard>
      <div>
        {tab === "modificari" && <AdminProfileChangesReview onCountChange={setPendingChangesCount} />}
        {tab === "profiluri" && <DirOpsProfiles />}
        {tab === "migrare" && <DirOpsMigrationQueue />}
      </div>
    </div>
  );
}
