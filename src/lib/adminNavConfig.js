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
  BarChart3,
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
// de date). Toate rutele vechi raman functionale - vezi LEGACY_SECTION_REDIRECTS.
// 2026-10-05: meniul reorganizat in 5 grupe (Azi, De rezolvat, Director,
// Clienți și comunicare, Sistem). Cheile si rutele raman neschimbate.
// 2026-10-07: fiecare sectiune si sub-tab are acum adresa ei (?s=...&t=...&id=...), vezi adminHref.
export const ADMIN_NAV_PRIMARY = [
  { key: "dashboard", label: "Panou de azi", icon: LayoutDashboard, groupLabel: "Azi" },
  { key: "workspace_reviews", label: "Coada de verificare", icon: ClipboardCheck },

  { key: "revendicari", label: "Revendicări", icon: UserCheck, groupLabel: "De rezolvat" },
  { key: "corectii", label: "Corecții și eliminări", icon: Flag },
  { key: "support_tickets", label: "Tichete suport", icon: LifeBuoy },

  { key: "profiluri", label: "Profiluri și locații", icon: Building2, groupLabel: "Director" },
  { key: "servicii", label: "Servicii pe locații", icon: Wrench },
  { key: "research", label: "Research director", icon: Search },

  { key: "contacte_pacienti", label: "Contacte din căutări", icon: Users, groupLabel: "Clienți și comunicare" },
  { key: "outreach", label: "Campanii și marketing", icon: Mail },
  { key: "automatic_emails", label: "Emailuri automate", icon: MailCheck },
];

export const ADMIN_NAV_SECONDARY = [
  { key: "analytics", label: "Analytics", icon: BarChart3, groupLabel: "Sistem" },
  { key: "billing", label: "Plăți și abonamente", icon: CreditCard },
  { key: "data_integrity", label: "Integritate date", icon: DatabaseZap },
];

// Scoase din sidebar-ul permanent 2026-09-12, dar raman rute valide (deschise prin buton, nu prin
// tab fix) - au nevoie de eticheta proprie.
const HIDDEN_SECTION_LABELS = {
  adauga: "Adaugă organizație / locație",
  import_directory: "Import director",
  geografie: "Geografie (SIRUTA)",
  audit: "Istoric audit",
};

export const ADMIN_NAV_LABELS = {
  ...Object.fromEntries(
    [...ADMIN_NAV_PRIMARY, ...ADMIN_NAV_SECONDARY].map((item) => [item.key, item.label]),
  ),
  ...HIDDEN_SECTION_LABELS,
  // Chei vechi (adrese salvate de dinainte de 2026-09-12): au eticheta ca sa nu apara goale.
  ai: "Research director",
  specialist_reviews: "Coada de verificare",
  fotografii: "Coada de verificare",
  setari: "Panou de azi",
  mapping: "Mapare și identitate",
  contract_geo: "Contract geografic",
};

export const ADMIN_BASE_PATH = "/admin/operatiuni";
export const ADMIN_DEFAULT_SECTION = "dashboard";

export const ADMIN_SECTIONS = Object.freeze(new Set([
  ...ADMIN_NAV_PRIMARY.map((item) => item.key),
  ...ADMIN_NAV_SECONDARY.map((item) => item.key),
  ...Object.keys(HIDDEN_SECTION_LABELS),
]));

// Adrese/chei vechi -> sectiunea de azi (+ sub-tab-ul in care a ajuns functia).
export const LEGACY_SECTION_REDIRECTS = Object.freeze({
  ai: { section: "research", tab: "ai" },
  specialist_reviews: { section: "workspace_reviews", tab: "professionals" },
  fotografii: { section: "workspace_reviews", tab: "workspace" },
  setari: { section: "dashboard", tab: "" },
  mapping: { section: "import_directory", tab: "mapping" },
  contract_geo: { section: "data_integrity", tab: "contract_geo" },
});

// Normalizeaza (sectiune, sub-tab) primite din adresa sau din butoane: aplica redirectarile vechi si
// cade pe Panou cand sectiunea nu exista.
export function resolveAdminTarget(section, tab = "") {
  const raw = String(section || "").trim();
  const legacy = LEGACY_SECTION_REDIRECTS[raw];
  if (legacy) return { section: legacy.section, tab: String(tab || "").trim() || legacy.tab };
  if (!raw || !ADMIN_SECTIONS.has(raw)) return { section: ADMIN_DEFAULT_SECTION, tab: "" };
  return { section: raw, tab: String(tab || "").trim() };
}

// Adresa unei sectiuni: /admin/operatiuni?s=profiluri&t=migrare&id=... (Panoul are adresa curata).
export function adminHref(section = ADMIN_DEFAULT_SECTION, tab = "", id = "") {
  const target = resolveAdminTarget(section, tab);
  const params = new URLSearchParams();
  if (target.section !== ADMIN_DEFAULT_SECTION) params.set("s", target.section);
  if (target.tab) params.set("t", target.tab);
  if (id) params.set("id", String(id));
  const query = params.toString();
  return query ? `${ADMIN_BASE_PATH}?${query}` : ADMIN_BASE_PATH;
}
