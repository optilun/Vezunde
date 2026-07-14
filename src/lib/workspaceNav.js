import { LayoutDashboard, FileText, Bookmark, Settings, Building2, Shield, Clock3, ListChecks } from "lucide-react";

export const PERSONAL_NAV = [
  { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
  { key: "requests", label: "Solicitarile mele", icon: FileText },
  { key: "saved", label: "Locatii salvate", icon: Bookmark },
  { key: "settings", label: "Setari", icon: Settings },
];

export const APPLICANT_NAV = [
  { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
  { key: "profile", label: "Profil public", icon: Building2 },
  { key: "hours", label: "Program", icon: Clock3 },
  { key: "services", label: "Servicii", icon: ListChecks },
  { key: "status", label: "Status solicitare", icon: FileText },
];

export function getProviderNav({
  canManageOrganizationProfile,
  canViewLocations,
  canManageMembers,
  canManageSettings,
}) {
  const nav = [
    { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
  ];
  if (canManageOrganizationProfile) nav.push({ key: "profile", label: "Profil public", icon: Building2 });
  if (canViewLocations) nav.push({ key: "locations", label: "Locatii", icon: Building2 });
  if (canManageMembers) nav.push({ key: "access", label: "Acces si utilizatori", icon: Shield });
  if (canManageSettings) nav.push({ key: "settings", label: "Setari", icon: Settings });
  return nav;
}
