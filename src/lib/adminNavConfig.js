import {
  LayoutDashboard,
  Search,
  Building2,
  Wrench,
  UserCheck,
  ClipboardCheck,
  DatabaseZap,
  LifeBuoy,
  Flag,
  Mail,
} from "lucide-react";

// Meniul admin e grupat pe intentie, nu ca lista plata: primele elemente sunt cele
// care cer actiune zilnica, apoi continutul directorului, apoi uneltele ocazionale.
// Modulele inca nefolosite (tichete, corectii, research) raman disponibile, dar nu
// mai ocupa pozitiile de sus.
//
// 2026-09-12: simplificare navigatie (14 -> 9 intrari). Ecranele folosite rar
// (Import director, Geografie, Istoric audit) nu mai au intrare permanenta in
// sidebar - raman accesibile prin butoane contextuale (dashboard, carduri conexe).
// Adauga organizatie/locatie e acum buton in Profiluri si locatii + dashboard.
// Mapare si identitate a devenit sub-tab in Import director (acelasi flux: import).
// Contract geografic a devenit sub-tab in Integritate date (acelasi flux: diagnostic
// de date). Toate rutele vechi raman functionale - vezi ADMIN_NAV_LABELS si
// LEGACY_TAB_REDIRECTS in AdminDirectoryOps.jsx.
export const ADMIN_NAV_PRIMARY = [
  { key: "dashboard", label: "Panou general", icon: LayoutDashboard, groupLabel: "De lucru" },
  { key: "workspace_reviews", label: "Coada de verificare", icon: ClipboardCheck },
  { key: "revendicari", label: "Revendicari", icon: UserCheck },

  { key: "profiluri", label: "Profiluri si locatii", icon: Building2, groupLabel: "Director" },
  { key: "servicii", label: "Catalog si eligibilitate", icon: Wrench },

  // 2026-09-12: outreach email - flux recurent (nu un ecran rar), asa ca primeste o
  // intrare permanenta, spre deosebire de ecranele mutate la buton in aceeasi simplificare.
  { key: "outreach", label: "Comunicare furnizori", icon: Mail, groupLabel: "Comunicare" },

  { key: "research", label: "Research director", icon: Search, groupLabel: "Calitate date" },

  { key: "corectii", label: "Corectii si eliminari", icon: Flag, groupLabel: "Cereri utilizatori" },
  { key: "support_tickets", label: "Tichete suport", icon: LifeBuoy },
];

export const ADMIN_NAV_SECONDARY = [
  { key: "data_integrity", label: "Integritate date", icon: DatabaseZap, groupLabel: "Sistem si diagnostic" },
];

export const ADMIN_NAV_LABELS = {
  ...Object.fromEntries(
    [...ADMIN_NAV_PRIMARY, ...ADMIN_NAV_SECONDARY].map((item) => [item.key, item.label]),
  ),
  ai: "Research director",
  specialist_reviews: "Coada de verificare",
  fotografii: "Coada de verificare",
  setari: "Setari",
  // Scoase din sidebar-ul permanent 2026-09-12, dar raman rute valide (deschise
  // prin buton, nu prin tab fix) - au nevoie de eticheta proprie mai jos.
  adauga: "Adauga organizatie / locatie",
  import_directory: "Import director",
  mapping: "Mapare si identitate",
  geografie: "Geografie",
  audit: "Istoric audit",
  contract_geo: "Contract geografic",
};
