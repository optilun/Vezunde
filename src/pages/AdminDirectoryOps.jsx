import React, { lazy, Suspense, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import AdminAppShell from "@/components/admin/shell/AdminAppShell";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import { ADMIN_NAV_LABELS } from "@/lib/adminNavConfig";
import "@/styles/admin-mobile.css";

const AdminDashboardHome = lazy(
  () => import("@/components/admin/dashboard/AdminDashboardHome"),
);
const AdminProfilesSection = lazy(
  () => import("@/components/admin/directory/AdminProfilesSection"),
);
const AdminReviewQueue = lazy(
  () => import("@/components/admin/review/AdminReviewQueue"),
);
const AdminSupportCenter = lazy(
  () => import("@/components/admin/support/AdminSupportCenter"),
);
const DirOpsCorrections = lazy(
  () => import("@/components/admin/directory/DirOpsCorrections"),
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
    "Creeaza o organizatie si prima locatie sau adauga manual un profil nou in director, cu provenienta obligatorie.",
  profiluri:
    "Gestioneaza locatiile din director, statusul de incredere si eventualele revizuiri de migrare.",
  workspace_reviews:
    "Analizeaza intr-un singur loc cererile trimise de furnizori, locatiile noi si profilurile specialistilor.",
  corectii:
    "Verifica sesizarile publice privind date gresite, locatii inchise, duplicate, asocieri incorecte si eliminarea datelor personale.",
  support_tickets:
    "Gestioneaza tichetele de suport si feedback-ul trimis din conturile utilizatorilor, din acelasi centru administrativ.",
  servicii:
    "Gestioneaza serviciile existente, nivelul de confirmare si eligibilitatea pentru rezultate.",
  revendicari: "Analizeaza cererile de revendicare a profilurilor.",
  geografie: "Sursa canonica de geografie VIASEE si importul SIRUTA.",
  audit: "Istoricul actiunilor administrative si al modificarilor aplicate.",
  data_integrity:
    "Detecteaza neconcordantele si permite numai reparatii deterministe, previzualizate si confirmate individual.",
  contract_geo:
    "Verificari de regresie pentru contractul geografic. Instrument intern.",
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
      Se incarca sectiunea...
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
    "corectii",
    "support_tickets",
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
              subtitle="Colecteaza, verifica si completeaza datele directorului. AI Copilot ramane inclus in acest flux si nu publica automat."
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
              {tab === "corectii" && <DirOpsCorrections />}
              {tab === "support_tickets" && <AdminSupportCenter adminUser={user} />}
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
