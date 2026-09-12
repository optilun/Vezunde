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
const DirOpsMapping = lazy(
  () => import("@/components/admin/directory/DirOpsMapping"),
);
const DirOpsImportPipeline = lazy(
  () => import("@/components/admin/directory/DirOpsImportPipeline"),
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
const AdminLocationGeocoding = lazy(
  () => import("@/components/admin/system/AdminLocationGeocoding"),
);
// Organizatii fragmentate (2026-08-19): scanare proactiva dupa duplicate in director.
const AdminFragmentedOrganizations = lazy(
  () => import("@/components/admin/system/AdminFragmentedOrganizations"),
);
const OutreachWorkspace = lazy(
  () => import("@/components/admin/outreach/OutreachWorkspace"),
);

const SIMPLE_HEADERS = {
  adauga:
    "Creeaza o organizatie si prima locatie sau adauga manual un profil nou in director, cu provenienta obligatorie.",
  profiluri:
    "Gestioneaza locatiile din director, statusul de incredere si eventualele revizuiri de migrare.",
  mapping:
    "Clarifica relatiile organizatie-locatie, tipurile canonice, conflictele, dublurile, rebrandingul si unitatile distincte de la aceeasi adresa.",
  import_directory:
    "Incarca snapshoturi imuabile, valideaza randurile, genereaza dry-run, executa loturi idempotente si retrage in siguranta modificarile aplicate.",
  workspace_reviews:
    "Analizeaza intr-un singur loc cererile trimise de furnizori, locatiile noi si profilurile specialistilor.",
  corectii:
    "Verifica sesizarile publice privind date gresite, locatii inchise, duplicate, asocieri incorecte si eliminarea datelor personale.",
  support_tickets:
    "Gestioneaza tichetele de suport si feedback-ul trimis din conturile utilizatorilor, din acelasi centru administrativ.",
  servicii:
    "Gestioneaza serviciile existente, nivelul de confirmare si eligibilitatea pentru rezultate.",
  revendicari: "Analizeaza cererile de revendicare a profilurilor.",
  outreach:
    "Trimite email-uri informative catre opticieni, clinici si cabinete deja din director, cu sabloane, segmentare si tracking de livrare.",
  geografie: "Sursa canonica de geografie VIASEE si importul SIRUTA.",
  audit: "Istoricul actiunilor administrative si al modificarilor aplicate.",
  data_integrity:
    "Detecteaza neconcordantele si permite reparatii deterministe individuale sau in lot, fuziuni controlate si operatii de geocodare administrate.",
  contract_geo:
    "Verificari de regresie pentru contractul geografic. Instrument intern.",
};

const LEGACY_TAB_REDIRECTS = {
  ai: "research",
  specialist_reviews: "workspace_reviews",
  fotografii: "workspace_reviews",
  setari: "dashboard",
  // 2026-09-12: Mapare si identitate si Contract geografic au devenit sub-tab-uri
  // in Import director, respectiv Integritate date - vezi ImportDirectorWorkspace
  // si DataIntegrityWorkspace mai jos.
  mapping: "import_directory",
  contract_geo: "data_integrity",
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

// Integritate date: fiecare sub-tab are acum si actiuni administrative in lot,
// pastrand confirmarea explicita si regulile de siguranta specifice tipului de operatie.
// 2026-09-12: Contract geografic (fost tab propriu, aproape niciodata folosit) a
// devenit al 5-lea sub-tab de aici - e tot un instrument de sanatate a datelor.
const DATA_INTEGRITY_SUBTABS = [
  { key: "probleme", label: "Probleme de date" },
  { key: "organizatii_fragmentate", label: "Organizatii fragmentate" },
  { key: "reparatii", label: "Reparatii controlate" },
  { key: "pozitii", label: "Pozitii pe harta" },
  { key: "contract_geo", label: "Contract geografic" },
];

function DataIntegrityWorkspace({ onNavigate }) {
  const [subTab, setSubTab] = useState("probleme");
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap gap-2">
          {DATA_INTEGRITY_SUBTABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSubTab(item.key)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${subTab === item.key ? "bg-foreground text-background" : "border border-border hover:bg-secondary"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("audit")}
            className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Vezi istoricul complet
          </button>
        )}
      </div>
      <div className="mt-5 space-y-5">
        {subTab === "probleme" && <AdminDataIntegrity />}
        {subTab === "organizatii_fragmentate" && <AdminFragmentedOrganizations />}
        {subTab === "reparatii" && <AdminDataRepairs />}
        {subTab === "pozitii" && <AdminLocationGeocoding />}
        {subTab === "contract_geo" && <GeoContractChecks />}
      </div>
    </div>
  );
}

// 2026-09-12: Mapare si identitate (fost tab propriu) a devenit sub-tab aici -
// ambiguitatile de mapare apar direct din procesul de import, e acelasi flux.
const IMPORT_DIRECTORY_SUBTABS = [
  { key: "import", label: "Import" },
  { key: "mapping", label: "Mapare si identitate" },
];

function ImportDirectorWorkspace() {
  const [subTab, setSubTab] = useState("import");
  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {IMPORT_DIRECTORY_SUBTABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSubTab(item.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${subTab === item.key ? "bg-foreground text-background" : "border border-border hover:bg-secondary"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-5">
        {subTab === "import" && <DirOpsImportPipeline />}
        {subTab === "mapping" && <DirOpsMapping />}
      </div>
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
    "import_directory",
    "servicii",
    "revendicari",
    "geografie",
    "audit",
    "data_integrity",
    "outreach",
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
              <AdminProfilesSection onNavigate={navigate} />
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
              {tab === "import_directory" && <ImportDirectorWorkspace />}
              {tab === "servicii" && <DirOpsServices />}
              {tab === "revendicari" && <DirOpsClaims />}
              {tab === "outreach" && <OutreachWorkspace />}
              {tab === "geografie" && <GeoImport />}
              {tab === "audit" && <DirOpsAudit />}
              {tab === "data_integrity" && <DataIntegrityWorkspace onNavigate={navigate} />}
            </div>
          </div>
        )}
      </Suspense>
    </AdminAppShell>
  );
}
