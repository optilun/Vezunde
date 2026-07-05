import React, { useState } from "react";
import DirOpsProfiles from "./DirOpsProfiles";
import DirOpsMigrationQueue from "./DirOpsMigrationQueue";

const TABS = [
  { key: "profiluri", label: "Toate profilurile" },
  { key: "migrare", label: "Review migrare" },
];

// UI-1: preserves the existing Profiluri + Review migrare tabs (unchanged
// logic), restyled as a modern segmented control.
export default function AdminProfilesSection() {
  const [tab, setTab] = useState("profiluri");
  return (
    <div>
      <div className="inline-flex bg-secondary rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${tab === t.key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tab === "profiluri" && <DirOpsProfiles />}
        {tab === "migrare" && <DirOpsMigrationQueue />}
      </div>
    </div>
  );
}