import React, { lazy, Suspense, useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import AdminAppShell from "@/components/admin/shell/AdminAppShell";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminTabs from "@/components/admin/ui/AdminTabs";
import { AdminConfirmProvider } from "@/components/admin/ui/AdminConfirm";
import { AdminCountsProvider } from "@/components/admin/useAdminCounts";
import { useAdminRoute, useAdminSubTab } from "@/components/admin/useAdminRoute";
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
const AutomaticEmailWorkspace = lazy(
  () => import("@/components/admin/automatic-emails/AutomaticEmailWorkspace"),
);

const AdminBillingCenter = lazy(() => import("@/components/admin/billing/AdminBillingCenter"));
// 2026-09-28: datele de contact lasate de pacienti la cautare (PatientSearchContact).
const AdminSearchContacts = lazy(() => import("@/components/admin/patients/AdminSearchContacts"));
const AdminAnalytics = lazy(() => import("@/components/admin/analytics/AdminAnalytics"));

// 2026-10-07: subtitlul e o singura linie; explicatiile mai lungi merg in `hint` (ⓘ), deci
// informatia ramane, dar nu mai ocupa pagina.
const SECTION_HEADERS = {
  research: {
    subtitle: "Colectează, verifică și completează datele directorului.",
    hint: "AI Copilot face doar drafturi de research. Nu publică și nu verifică nimic automat.",
  },
  billing: { subtitle: "Facturi, încasări și abonamente Pro." },
  contacte_pacienti: {
    subtitle: "Pacienți care și-au lăsat datele la finalul unei căutări.",
    hint: "Ofertele se trimit doar celor marcați „Poate primi oferte”, adică cei care au dat un acord separat.",
  },
  adauga: { subtitle: "Creează o organizație și prima ei locație, cu sursa obligatorie." },
  profiluri: { subtitle: "Locațiile din director și starea lor." },
  import_directory: {
    subtitle: "Importuri verificate: dry-run, aprobare, execuție și retragere.",
    hint: "Fiecare import pornește dintr-un snapshot imuabil, se verifică pe rânduri și rulează în loturi idempotente. Modificările aplicate pot fi retrase în siguranță.",
  },
  workspace_reviews: { subtitle: "Ce au trimis furnizorii și așteaptă decizia ta." },
  corectii: { subtitle: "Sesizări publice: date greșite, locații închise, duplicate, date personale." },
  support_tickets: { subtitle: "Tichete de suport și feedback din conturi." },
  servicii: {
    subtitle: "Serviciile fiecărei locații și eligibilitatea pentru rezultate.",
    hint: "Aici administrezi serviciile unei locații și recalculezi dacă pot intra în recomandări. Serviciile medicale rămân blocate până la verificarea VIASEE.",
  },
  revendicari: { subtitle: "Cereri de revendicare a profilurilor." },
  outreach: { subtitle: "Campanii, contacte și șabloane de marketing." },
  automatic_emails: { subtitle: "Mesajele automate trimise de VIASEE." },
  geografie: { subtitle: "Sursa canonică de localități (SIRUTA)." },
  audit: { subtitle: "Cine a schimbat ce și când." },
  data_integrity: {
    subtitle: "Neconcordanțe în date, reparații controlate și poziții pe hartă.",
    hint: "Verificarea doar citește. Reparațiile și geocodarea sunt acțiuni separate, cu confirmare.",
  },
};

// Secțiunile care au antet comun (restul — Panou, Analytics — își desenează singure antetul).
const SECTIONS_WITH_HEADER = Object.keys(SECTION_HEADERS);

// Integritate date: fiecare sub-tab are acum si actiuni administrative in lot,
// pastrand confirmarea explicita si regulile de siguranta specifice tipului de operatie.
// 2026-09-12: Contract geografic (fost tab propriu, aproape niciodata folosit) a
// devenit al 5-lea sub-tab de aici - e tot un instrument de sanatate a datelor.
const DATA_INTEGRITY_SUBTABS = [
  { key: "probleme", label: "Probleme de date" },
  { key: "organizatii_fragmentate", label: "Organizații fragmentate" },
  { key: "reparatii", label: "Reparații controlate" },
  { key: "pozitii", label: "Poziții pe hartă" },
  { key: "contract_geo", label: "Contract geografic" },
];

function DataIntegrityWorkspace({ onNavigate }) {
  const [subTab, setSubTab] = useAdminSubTab(DATA_INTEGRITY_SUBTABS.map((item) => item.key), "probleme");
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <AdminTabs tabs={DATA_INTEGRITY_SUBTABS} value={subTab} onChange={setSubTab} label="Integritate date" />
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
  { key: "mapping", label: "Mapare și identitate" },
];

function ImportDirectorWorkspace() {
  const [subTab, setSubTab] = useAdminSubTab(IMPORT_DIRECTORY_SUBTABS.map((item) => item.key), "import");
  return (
    <div>
      <div className="border-b border-border pb-4">
        <AdminTabs tabs={IMPORT_DIRECTORY_SUBTABS} value={subTab} onChange={setSubTab} label="Import director" />
      </div>
      <div className="mt-5 space-y-5">
        {subTab === "import" && <DirOpsImportPipeline />}
        {subTab === "mapping" && <DirOpsMapping />}
      </div>
    </div>
  );
}

function AdminWorkspace() {
  const { logout, user } = useAuth();
  const { section, go } = useAdminRoute();
  const navigate = (nextSection, nextTab = "") => go(nextSection, nextTab);
  const firstRender = useRef(true);

  // Titlul filei urmează secțiunea. La schimbarea secțiunii: sus pe pagină și focus pe conținut
  // (nu la prima încărcare, ca să nu fure focusul).
  useEffect(() => {
    document.title = `${ADMIN_NAV_LABELS[section] || "Administrare"} · Administrare VIASEE`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [section]);

  const header = SECTION_HEADERS[section];

  return (
    <AdminAppShell activeKey={section} user={user} onLogout={() => logout(true)}>
      <Suspense fallback={<AdminLoading label="Se încarcă secțiunea…" />}>
        {section === "dashboard" && <AdminDashboardHome onNavigate={navigate} />}

        {section === "analytics" && <AdminAnalytics onNavigate={navigate} />}

        {SECTIONS_WITH_HEADER.includes(section) && (
          <div>
            <AdminPageHeader title={ADMIN_NAV_LABELS[section]} subtitle={header.subtitle} hint={header.hint} />
            <div className="mt-6">
              {section === "research" && <DirResearch onNavigate={navigate} />}
              {section === "profiluri" && <AdminProfilesSection onNavigate={navigate} />}
              {section === "adauga" && <DirOpsAddLocation />}
              {section === "workspace_reviews" && <AdminReviewQueue />}
              {section === "corectii" && <DirOpsCorrections />}
              {section === "support_tickets" && <AdminSupportCenter adminUser={user} />}
              {section === "import_directory" && <ImportDirectorWorkspace />}
              {section === "servicii" && <DirOpsServices />}
              {section === "revendicari" && <DirOpsClaims />}
              {section === "outreach" && <OutreachWorkspace />}
              {section === "automatic_emails" && <AutomaticEmailWorkspace />}
              {section === "billing" && <AdminBillingCenter />}
              {section === "contacte_pacienti" && <AdminSearchContacts />}
              {section === "geografie" && <GeoImport />}
              {section === "audit" && <DirOpsAudit />}
              {section === "data_integrity" && <DataIntegrityWorkspace onNavigate={navigate} />}
            </div>
          </div>
        )}
      </Suspense>
    </AdminAppShell>
  );
}

export default function AdminDirectoryOps() {
  return (
    <AdminCountsProvider>
      <AdminConfirmProvider>
        <AdminWorkspace />
      </AdminConfirmProvider>
    </AdminCountsProvider>
  );
}
