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
  MailCheck,
  CreditCard,
  Users,
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
// 2026-10-05: meniul reorganizat in 5 grupe (Azi, De rezolvat, Director,
// Clienți și comunicare, Sistem). Cheile si rutele raman neschimbate.
export const ADMIN_NAV_PRIMARY = [
  { key: "dashboard", label: "Panou general", icon: LayoutDashboard, groupLabel: "Azi" },
  { key: "workspace_reviews", label: "Coada de verificare", icon: ClipboardCheck },

  { key: "revendicari", label: "Revendicări", icon: UserCheck, groupLabel: "De rezolvat" },
  { key: "corectii", label: "Corecții și eliminări", icon: Flag },
  { key: "support_tickets", label: "Tichete suport", icon: LifeBuoy },

  { key: "profiluri", label: "Profiluri și locații", icon: Building2, groupLabel: "Director" },
  { key: "servicii", label: "Catalog și eligibilitate", icon: Wrench },
  { key: "research", label: "Research director", icon: Search },

  { key: "contacte_pacienti", label: "Contacte din căutări", icon: Users, groupLabel: "Clienți și comunicare" },
  { key: "outreach", label: "Campanii și marketing", icon: Mail },
  { key: "automatic_emails", label: "Emailuri automate", icon: MailCheck },
];

export const ADMIN_NAV_SECONDARY = [
  { key: "billing", label: "Plăți și abonamente", icon: CreditCard, groupLabel: "Sistem" },
  { key: "data_integrity", label: "Integritate date", icon: DatabaseZap },
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