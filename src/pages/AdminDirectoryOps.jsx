import React, { lazy, Suspense, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import AdminAppShell from "@/components/admin/shell/AdminAppShell";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import { ADMIN_NAV_LABELS } from "@/lib/adminNavConfig";

const AdminDashboardHome = lazy(
  () => import("@/components/admin/dashboard/AdminDashboardHome"),
);
const AdminProfilesSection = lazy(
  () => import("@/components/admin/directory/AdminProfilesSection"),
);
const AdminReviewQueue = lazy(
  () => import("@/components/admin/review/AdminReviewQueue"),
);
const DirOpsAddLocation = lazy(
  () => import("@/components/admin/directory/DirOpsAddLocation"),
);
const DirOpsServices = lazy(
  () => import("@/components/admin/directory/DirOpsServices"),
);
const DirOpsClaims = lazy(
  () => import("@/components/admin/directory/DirOpsClaims"),
);
const DirOpsAudit = lazy(
  () => import("@/components/admin/directory/DirOpsAudit"),
);
const DirResearch = lazy(
  () => import("@/components/admin/directory/DirResearch"),
);
const GeoContractChecks = lazy(
  () => import("@/components/admin/directory/GeoContractChecks"),
);
const GeoImport = lazy(
  () => import("@/components/admin/directory/research/GeoImport"),
);
const AdminDataIntegrity = lazy(
  () => import("@/components/admin/system/AdminDataIntegrity"),
);
const AdminDataRepairs = lazy(
  () => import("@/components/admin/system/AdminDataRepairs"),
);

const SIMPLE_HEADERS = {
  adauga:
    "Creează o organizație și prima locație sau adaugă manual un profil nou în director, cu proveniență obligatorie.",
  profiluri:
    "Gestionează locațiile din director, statusul de încredere și eventualele revizuiri de migrare.",
  workspace_reviews:
    "Analizează într-un singur loc cererile trimise de furnizori, locațiile noi și profilurile specialiștilor.",
  servicii:
    "Gestionează serviciile existente, nivelul de confirmare și eligibilitatea pentru rezultate.",
  revendicari: "Analizează cererile de revendicare a profilurilor.",
  geografie: "Sursa canonică de geografie VIASEE și importul SIRUTA.",
  audit: "Istoricul acțiunilor administrative și al modificărilor aplicate.",
  data_integrity:
    "Detectează neconcordanțele și permite numai reparații deterministe, previzualizate și confirmate individual.",
  contract_geo:
    "Verificări de regresie pentru contractul geografic. Instrument intern.",
};

const LEGACY_TAB_REDIRECTS = {
  ai: "research",
  specialist_reviews: "workspace_reviews",
  fotografii: "workspace_reviews",
  setari: "dashboard",
};

function SectionLoading() {
  return (
    <div
      className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"
      role="status"
    >
      Se încarcă secțiunea...
    </div>
  );
}

export default function AdminDirectoryOps() {
  const [tab, setTab] = useState("dashboard");
  const { logout, user } = useAuth();

  const navigate = (nextTab) =>
    setTab(LEGACY_TAB_REDIRECTS[nextTab] || nextTab);
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
    <AdminAppShell
      activeKey={tab}
      onNavigate={navigate}
      user={user}
      onLogout={() => logout(true)}
    >
      <Suspense fallback={<SectionLoading />}>
        {tab === "dashboard" && <AdminDashboardHome onNavigate={navigate} />}

        {tab === "research" && (
          <div>
            <AdminPageHeader
              title="Research director"
              subtitle="Colectează, verifică și completează datele directorului. AI Copilot rămâne inclus în acest flux și nu publică automat."
            />
            <div className="mt-6">
              <DirResearch onNavigate={navigate} />
            </div>
          </div>
        )}

        {tab === "profiluri" && (
          <div>
            <AdminPageHeader
              title={ADMIN_NAV_LABELS.profiluri}
              subtitle={SIMPLE_HEADERS.profiluri}
            />
            <div className="mt-6">
              <AdminProfilesSection />
            </div>
          </div>
        )}

        {simpleTabsWithHeader.includes(tab) && (
          <div>
            <AdminPageHeader
              title={ADMIN_NAV_LABELS[tab]}
              subtitle={SIMPLE_HEADERS[tab]}
            />
            <div className="mt-6">
              {tab === "adauga" && <DirOpsAddLocation />}
              {tab === "workspace_reviews" && <AdminReviewQueue />}
              {tab === "servicii" && <DirOpsServices />}
              {tab === "revendicari" && <DirOpsClaims />}
              {tab === "geografie" && <GeoImport />}
              {tab === "audit" && <DirOpsAudit />}
              {tab === "data_integrity" && (
                <div className="space-y-5">
                  <AdminDataIntegrity />
                  <AdminDataRepairs />
                </div>
              )}
              {tab === "contract_geo" && <GeoContractChecks />}
            </div>
          </div>
        )}
      </Suspense>
    </AdminAppShell>
  );
}
