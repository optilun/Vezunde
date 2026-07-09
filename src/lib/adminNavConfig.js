import { LayoutDashboard, Search, Sparkles, PlusCircle, Building2, Wrench, UserCheck, MapPin, History, ShieldCheck, Settings, ClipboardCheck } from "lucide-react";

// UI-1: shared nav config for the admin app shell. Keys map 1:1 to the
// existing tab keys already used by AdminDirectoryOps — no routes changed.
export const ADMIN_NAV_PRIMARY = [
  { key: "dashboard", label: "Panou general", icon: LayoutDashboard },
  { key: "research", label: "Research director", icon: Search },
  { key: "ai", label: "AI Copilot", icon: Sparkles },
  { key: "adauga", label: "Adauga locatie", icon: PlusCircle },
  { key: "profiluri", label: "Profiluri director", icon: Building2 },
  { key: "workspace_reviews", label: "Modificari workspace", icon: ClipboardCheck },
  { key: "servicii", label: "Servicii", icon: Wrench },
  { key: "revendicari", label: "Revendicari", icon: UserCheck },
  { key: "geografie", label: "Geografie", icon: MapPin },
  { key: "audit", label: "Istoric audit", icon: History },
];

export const ADMIN_NAV_SECONDARY = [
  { key: "contract_geo", label: "Contract geografic", icon: ShieldCheck, groupLabel: "Diagnostic intern" },
  { key: "setari", label: "Setari", icon: Settings },
];

export const ADMIN_NAV_LABELS = Object.fromEntries(
  [...ADMIN_NAV_PRIMARY, ...ADMIN_NAV_SECONDARY].map((n) => [n.key, n.label])
);
