import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AdminAppShell from "@/components/admin/shell/AdminAppShell";
import AdminDashboardHome from "@/components/admin/dashboard/AdminDashboardHome";
import AdminProfilesSection from "@/components/admin/directory/AdminProfilesSection";
import AdminWorkspaceSubmissionsReview from "@/components/admin/directory/AdminWorkspaceSubmissionsReview";
import AdminNewLocationReview from "@/components/admin/directory/AdminNewLocationReview";
import AdminProfessionalProfileReview from "@/components/admin/directory/AdminProfessionalProfileReview";
import AdminLocationPhotoReview from "@/components/admin/directory/AdminLocationPhotoReview";
import AdminSettingsPlaceholder from "@/components/admin/AdminSettingsPlaceholder";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import DirOpsAddLocation from "@/components/admin/directory/DirOpsAddLocation";
import DirOpsServices from "@/components/admin/directory/DirOpsServices";
import DirOpsClaims from "@/components/admin/directory/DirOpsClaims";
import DirOpsAudit from "@/components/admin/directory/DirOpsAudit";
import DirResearch from "@/components/admin/directory/DirResearch";
import GeoContractChecks from "@/components/admin/directory/GeoContractChecks";
import AICopilot from "@/components/admin/directory/research/AICopilot";
import GeoImport from "@/components/admin/directory/research/GeoImport";
import { ADMIN_NAV_LABELS } from "@/lib/adminNavConfig";

const SIMPLE_HEADERS = {
  adauga: "Adaugă o organizație și o locație nouă în director, cu proveniență obligatorie.",
  profiluri: "Gestionează statusul de încredere al profilurilor din director.",
  workspace_reviews: "Analizează modificările și locațiile noi trimise de furnizori înainte de publicare.",
  specialist_reviews: "Verifică profilurile profesionale trimise de specialiști înainte de publicare.",
  fotografii: "Verifică fotografia principală trimisă pentru fiecare locație înainte de publicare.",
  servicii: "Gestionează serviciile confirmate pentru fiecare locație.",
  revendicari: "Analizează cererile de revendicare a profilurilor.",
  geografie: "Sursa canonică de geografie Vezunde (import SIRUTA).",
  audit: "Istoricul acțiunilor administrative înregistrate.",
  contract_geo: "Verificări de regresie pentru contractul geografic — instrument intern.",
};

export default function AdminDirectoryOps() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("dashboard");
  const { logout } = useAuth();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="max-w-5xl mx-auto px-4 py-16 text-muted-foreground">Se încarcă...</div>;
  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="font-heading text-xl font-bold">Acces restricționat</h1>
        <p className="text-muted-foreground mt-2">Această zonă este disponibilă doar administratorilor Vezunde.</p>
      </div>
    );
  }

  const simpleTabsWithHeader = ["adauga", "workspace_reviews", "specialist_reviews", "fotografii", "servicii", "revendicari", "geografie", "audit", "contract_geo"];

  return (
    <AdminAppShell activeKey={tab} onNavigate={setTab} user={user} onLogout={() => logout(true)}>
      {tab === "dashboard" && <AdminDashboardHome onNavigate={setTab} />}
      {tab === "research" && (
        <div>
          <AdminPageHeader title="Research director" subtitle="Modul intern de research pentru colectarea și validarea datelor de director." />
          <div className="mt-6"><DirResearch onNavigate={setTab} /></div>
        </div>
      )}
      {tab === "ai" && (
        <div>
          <AdminPageHeader title="AI Copilot" subtitle="Generează doar drafturi de research, cu dovezi verificabile — nicio scriere automată în director." />
          <div className="mt-6"><AICopilot onNavigate={setTab} /></div>
        </div>
      )}
      {tab === "profiluri" && (
        <div>
          <AdminPageHeader title="Profiluri director" subtitle={SIMPLE_HEADERS.profiluri} />
          <div className="mt-6"><AdminProfilesSection /></div>
        </div>
      )}
      {simpleTabsWithHeader.includes(tab) && (
        <div>
          <AdminPageHeader title={ADMIN_NAV_LABELS[tab]} subtitle={SIMPLE_HEADERS[tab]} />
          <div className="mt-6">
            {tab === "adauga" && <DirOpsAddLocation />}
            {tab === "workspace_reviews" && <div className="space-y-6"><AdminNewLocationReview /><AdminWorkspaceSubmissionsReview /></div>}
            {tab === "specialist_reviews" && <AdminProfessionalProfileReview />}
            {tab === "fotografii" && <AdminLocationPhotoReview />}
            {tab === "servicii" && <DirOpsServices />}
            {tab === "revendicari" && <DirOpsClaims />}
            {tab === "geografie" && <GeoImport />}
            {tab === "audit" && <DirOpsAudit />}
            {tab === "contract_geo" && <GeoContractChecks />}
          </div>
        </div>
      )}
      {tab === "setari" && <AdminSettingsPlaceholder />}
    </AdminAppShell>
  );
}
