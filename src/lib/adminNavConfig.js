import {
  LayoutDashboard,
  Search,
  PlusCircle,
  Building2,
  Wrench,
  UserCheck,
  MapPin,
  History,
  ShieldCheck,
  ClipboardCheck,
  DatabaseZap,
  LifeBuoy,
  Flag,
  GitMerge,
  PackageOpen,
} from "lucide-react";

// Meniul admin e grupat pe intentie, nu ca lista plata: primele elemente sunt cele
// care cer actiune zilnica, apoi continutul directorului, apoi uneltele ocazionale.
// Modulele inca nefolosite (tichete, corectii, research) raman disponibile, dar nu
// mai ocupa pozitiile de sus.
export const ADMIN_NAV_PRIMARY = [
  { key: "dashboard", label: "Panou general", icon: LayoutDashboard, groupLabel: "De lucru" },
  { key: "workspace_reviews", label: "Coada de verificare", icon: ClipboardCheck },
  { key: "revendicari", label: "Revendicari", icon: UserCheck },

  { key: "profiluri", label: "Profiluri si locatii", icon: Building2, groupLabel: "Director" },
  { key: "adauga", label: "Adauga organizatie / locatie", icon: PlusCircle },
  { key: "servicii", label: "Catalog si eligibilitate", icon: Wrench },
  { key: "import_directory", label: "Import director", icon: PackageOpen },

  { key: "mapping", label: "Mapare si identitate", icon: GitMerge, groupLabel: "Calitate date" },
  { key: "research", label: "Research director", icon: Search },
  { key: "geografie", label: "Geografie", icon: MapPin },
  { key: "audit", label: "Istoric audit", icon: History },

  { key: "corectii", label: "Corectii si eliminari", icon: Flag, groupLabel: "Cereri utilizatori" },
  { key: "support_tickets", label: "Tichete suport", icon: LifeBuoy },
];

export const ADMIN_NAV_SECONDARY = [
  { key: "data_integrity", label: "Integritate date", icon: DatabaseZap, groupLabel: "Sistem si diagnostic" },
  { key: "contract_geo", label: "Contract geografic", icon: ShieldCheck },
];

export const ADMIN_NAV_LABELS = {
  ...Object.fromEntries(
    [...ADMIN_NAV_PRIMARY, ...ADMIN_NAV_SECONDARY].map((item) => [item.key, item.label]),
  ),
  ai: "Research director",
  specialist_reviews: "Coada de verificare",
  fotografii: "Coada de verificare",
  setari: "Setari",
};
