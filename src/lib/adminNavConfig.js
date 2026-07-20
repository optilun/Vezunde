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
} from "lucide-react";

export const ADMIN_NAV_PRIMARY = [
  { key: "dashboard", label: "Panou general", icon: LayoutDashboard },
  { key: "workspace_reviews", label: "Coada de verificare", icon: ClipboardCheck },
  { key: "corectii", label: "Corectii si eliminari", icon: Flag },
  { key: "support_tickets", label: "Tichete suport", icon: LifeBuoy },
  { key: "revendicari", label: "Revendicari", icon: UserCheck },
  { key: "profiluri", label: "Profiluri si locatii", icon: Building2 },
  { key: "mapping", label: "Mapare si identitate", icon: GitMerge },
  { key: "servicii", label: "Catalog si eligibilitate", icon: Wrench },
  { key: "research", label: "Research director", icon: Search },
  { key: "adauga", label: "Adauga organizatie / locatie", icon: PlusCircle },
  { key: "geografie", label: "Geografie", icon: MapPin },
  { key: "audit", label: "Istoric audit", icon: History },
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
