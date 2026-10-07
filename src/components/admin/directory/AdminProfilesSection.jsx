import React from "react";
import { Plus } from "lucide-react";
import DirOpsProfiles from "./DirOpsProfiles";
import DirOpsMigrationQueue from "./DirOpsMigrationQueue";
import AdminTabs from "@/components/admin/ui/AdminTabs";
import AdminHint from "@/components/admin/ui/AdminHint";
import { useAdminSubTab } from "@/components/admin/useAdminRoute";

const TABS = [
  { key: "profiluri", label: "Toate profilurile" },
  { key: "migrare", label: "Review migrare" },
];

// 2026-10-07: fără cardul cu text lung; informația despre cererile furnizorilor stă în ⓘ.
export default function AdminProfilesSection({ onNavigate }) {
  const [tab, setTab] = useAdminSubTab(TABS.map((item) => item.key), "profiluri");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <AdminTabs tabs={TABS} value={tab} onChange={setTab} label="Profiluri și locații" />
          <AdminHint label="Unde ajung modificările trimise de furnizori">
            Modificările trimise de furnizori nu se mai aprobă de aici. Le găsești în <strong>Coada de verificare</strong>.
          </AdminHint>
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("adauga")}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adaugă locație
          </button>
        )}
      </div>

      {tab === "profiluri" && <DirOpsProfiles />}
      {tab === "migrare" && <DirOpsMigrationQueue />}
    </div>
  );
}
