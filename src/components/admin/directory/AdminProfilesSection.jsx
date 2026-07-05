import React, { useState } from "react";
import DirOpsProfiles from "./DirOpsProfiles";
import DirOpsMigrationQueue from "./DirOpsMigrationQueue";
import AdminCard from "@/components/admin/ui/AdminCard";

const TABS = [
  { key: "profiluri", label: "Toate profilurile" },
  { key: "migrare", label: "Review migrare" },
];

// UI-1 / UI-1.1E: preserves the existing Profiluri + Review migrare tabs
// (unchanged logic), tabs and content now live inside dedicated card surfaces.
export default function AdminProfilesSection() {
  const [tab, setTab] = useState("profiluri");
  return (
    <div className="space-y-5">
      <AdminCard className="p-2 inline-flex gap-1">
        {TABS.map((t) => (
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
        {tab === "profiluri" && <DirOpsProfiles />}
        {tab === "migrare" && <DirOpsMigrationQueue />}
      </div>
    </div>
  );
}