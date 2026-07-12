import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AdminAppShell from "@/components/admin/shell/AdminAppShell";
import AdminDashboardHome from "@/components/admin/dashboard/AdminDashboardHome";
import AdminProfilesSection from "@/components/admin/directory/AdminProfilesSection";
import AdminReviewQueue from "@/components/admin/review/AdminReviewQueue";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import DirOpsAddLocation from "@/components/admin/directory/DirOpsAddLocation";
import DirOpsServices from "@/components/admin/directory/DirOpsServices";
import DirOpsClaims from "@/components/admin/directory/DirOpsClaims";
import DirOpsAudit from "@/components/admin/directory/DirOpsAudit";
import DirResearch from "@/components/admin/directory/DirResearch";
import GeoContractChecks from "@/components/admin/directory/GeoContractChecks";
import GeoImport from "@/components/admin/directory/research/GeoImport";
import AdminDataIntegrity from "@/components/admin/system/AdminDataIntegrity";
import { ADMIN_NAV_LABELS } from "@/lib/adminNavConfig";

const SIMPLE_HEADERS = {
  adauga: "Creeaza o organizatie si prima locatie sau adauga manual un profil nou in director, cu provenienta obligatorie.",
  profiluri: "Gestioneaza locatiile din director, statusul de incredere si eventualele revizuiri de migrare.",
  workspace_reviews: "Analizeaza intr-un singur loc cererile trimise de furnizori, locatiile noi si profilurile specialistilor.",
  servicii: "Gestioneaza serviciile existente, nivelul de confirmare si eligibilitatea pentru matching.",
  revendicari: "Analizeaza cererile de revendicare a profilurilor.",
  geografie: "Sursa canonica de geografie Vezunde si importul SIRUTA.",
  audit: "Istoricul actiunilor administrative si al modificarilor aplicate.",
  data_integrity: "Detecteaza relatii rupte, statusuri contradictorii, completitudine nealiniata si date legacy. Verificarea nu modifica datele.",
  contract_geo: "Verificari de regresie pentru contractul geografic. Instrument intern.",
};

const LEGACY_TAB_REDIRECTS = {
  ai: "research",
  specialist_reviews: "workspace_reviews",
  fotografii: "workspace_reviews",
  setari: "dashboard",
};

export default function AdminDirectoryOps() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState("dashboard");
  const { logout } = useAuth();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-muted-foreground">Se incarca...</div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="font-heading text-xl font-bold">Acces restrictionat</h1>
        <p className="mt-2 text-muted-foreground">Aceasta zona este disponibila doar administratorilor Vezunde.</p>
      </div>
    );
  }

  const navigate = (nextTab) => setTab(LEGACY_TAB_REDIRECTS[nextTab] || nextTab);
  const simpleTabsWithHeader = [
    "adauga",
    "workspace_reviews",
    "servicii",
    "revendicari",
    "geografie",
    "audit",
    "data_integrity",
    "contract_geo",
  ];

  return (
    <AdminAppShell activeKey={tab} onNavigate={navigate} user={user} onLogout={() => logout(true)}>
      {tab === "dashboard" && <AdminDashboardHome onNavigate={navigate} />}

      {tab === "research" && (
        <div>
          <AdminPageHeader
            title="Research director"
            subtitle="Colecteaza, verifica si completeaza datele directorului. AI Copilot ramane inclus in acest flux si nu publica automat."
          />
          <div className="mt-6"><DirResearch onNavigate={navigate} /></div>
        </div>
      )}

      {tab === "profiluri" && (
        <div>
          <AdminPageHeader title={ADMIN_NAV_LABELS.profiluri} subtitle={SIMPLE_HEADERS.profiluri} />
          <div className="mt-6"><AdminProfilesSection /></div>
        </div>
      )}

      {simpleTabsWithHeader.includes(tab) && (
        <div>
          <AdminPageHeader title={ADMIN_NAV_LABELS[tab]} subtitle={SIMPLE_HEADERS[tab]} />
          <div className="mt-6">
            {tab === "adauga" && <DirOpsAddLocation />}
            {tab === "workspace_reviews" && <AdminReviewQueue />}
            {tab === "servicii" && <DirOpsServices />}
            {tab === "revendicari" && <DirOpsClaims />}
            {tab === "geografie" && <GeoImport />}
            {tab === "audit" && <DirOpsAudit />}
            {tab === "data_integrity" && <AdminDataIntegrity />}
            {tab === "contract_geo" && <GeoContractChecks />}
          </div>
        </div>
      )}
    </AdminAppShell>
  );
}
