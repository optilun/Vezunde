import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DirOpsDashboard from "@/components/admin/directory/DirOpsDashboard";
import DirOpsAddLocation from "@/components/admin/directory/DirOpsAddLocation";
import DirOpsProfiles from "@/components/admin/directory/DirOpsProfiles";
import DirOpsServices from "@/components/admin/directory/DirOpsServices";
import DirOpsMigrationQueue from "@/components/admin/directory/DirOpsMigrationQueue";
import DirOpsClaims from "@/components/admin/directory/DirOpsClaims";
import DirOpsAudit from "@/components/admin/directory/DirOpsAudit";

const TABS = [
  { key: "dashboard", label: "Panou" },
  { key: "adauga", label: "Adauga organizatie/locatie" },
  { key: "profiluri", label: "Profiluri directory" },
  { key: "servicii", label: "Servicii" },
  { key: "migrare", label: "Review migrare" },
  { key: "revendicari", label: "Revendicari" },
  { key: "audit", label: "Istoric audit" },
];

export default function AdminDirectoryOps() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="max-w-5xl mx-auto px-4 py-16 text-muted-foreground">Se incarca...</div>;
  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="font-heading text-xl font-bold">Acces restrictionat</h1>
        <p className="text-muted-foreground mt-2">Aceasta zona este disponibila doar administratorilor Vezunde.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="font-heading text-2xl font-bold">Operatiuni director</h1>
      <p className="text-muted-foreground text-sm mt-1">Modul intern de administrare a datelor de director. Toate actiunile sunt inregistrate in audit.</p>
      <div className="flex flex-wrap gap-2 mt-6 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t.key ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-accent"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "dashboard" && <DirOpsDashboard onNavigate={setTab} />}
        {tab === "adauga" && <DirOpsAddLocation />}
        {tab === "profiluri" && <DirOpsProfiles />}
        {tab === "servicii" && <DirOpsServices />}
        {tab === "migrare" && <DirOpsMigrationQueue />}
        {tab === "revendicari" && <DirOpsClaims />}
        {tab === "audit" && <DirOpsAudit />}
      </div>
    </div>
  );
}