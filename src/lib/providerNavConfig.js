import { LayoutDashboard } from "lucide-react";

// UI-1.1: minimal nav config for the provider/specialist account shell.
export const PROVIDER_NAV_PRIMARY = [
  { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
];

export const PROVIDER_NAV_LABELS = Object.fromEntries(
  PROVIDER_NAV_PRIMARY.map((n) => [n.key, n.label])
);