import { LayoutDashboard, FileText, Bookmark, Settings, Building2, Inbox } from "lucide-react";

export const PERSONAL_NAV = [
  { key: "overview", label: "Prezentare generala", shortLabel: "Acasă", icon: LayoutDashboard },
  { key: "requests", label: "Solicitarile mele", shortLabel: "Cereri", icon: FileText },
  { key: "saved", label: "Locatii salvate", shortLabel: "Salvate", icon: Bookmark },
  { key: "settings", label: "Setari", shortLabel: "Setări", icon: Settings },
];

// O singura interfata de organizatie: spatiul de furnizor. Pana la aprobarea
// revendicarii, contul vede doar starea solicitarii - fara ecrane de ciorna paralele.
export const APPLICANT_NAV = [
  { key: "status", label: "Status solicitare", shortLabel: "Status", icon: FileText },
];

export function getProviderNav({
  canManageOrganizationProfile,
  canViewLocations,
  canManageRequests,
  canManageMembers,
  canManageSettings,
}) {
  void canManageMembers;
  const nav = [
    { key: "overview", label: "Prezentare generala", shortLabel: "Acasă", icon: LayoutDashboard },
  ];
  if (canManageOrganizationProfile) nav.push({ key: "profile", label: "Profil public", shortLabel: "Profil", icon: Building2 });
  if (canViewLocations) nav.push({ key: "locations", label: "Locatii", shortLabel: "Locații", icon: Building2 });
  if (canManageRequests) nav.push({ key: "leads", label: "Leaduri", shortLabel: "Cereri", icon: Inbox });
  if (canManageSettings) nav.push({ key: "settings", label: "Setari", shortLabel: "Setări", icon: Settings });
  return nav;
}