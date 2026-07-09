import { Building2, LayoutDashboard, MapPin, Settings, Users } from "lucide-react";
import { PROVIDER_NAV_KEYS } from "@/lib/providerWorkspaceCatalog";

export const PROVIDER_NAV_PRIMARY = [
  { key: PROVIDER_NAV_KEYS.overview, label: "Prezentare generala", icon: LayoutDashboard },
  { key: PROVIDER_NAV_KEYS.organization, label: "Profil public", icon: Building2 },
  { key: PROVIDER_NAV_KEYS.locations, label: "Locatii", icon: MapPin },
  { key: PROVIDER_NAV_KEYS.access, label: "Acces si utilizatori", icon: Users },
];

export const PROVIDER_NAV_SECONDARY = [
  { key: PROVIDER_NAV_KEYS.settings, label: "Setari", icon: Settings },
];

export const PROVIDER_NAV_LABELS = Object.fromEntries(
  [...PROVIDER_NAV_PRIMARY, ...PROVIDER_NAV_SECONDARY].map((n) => [n.key, n.label])
);
