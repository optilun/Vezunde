import { LayoutDashboard, FileText, Settings, Building2, Inbox, Users, History } from "lucide-react";

// 2026-10-03 (structura conturilor, pasul 1). Contul personal este contul de pacient: cererile
// trimise ca pacient. Revendicarile de organizatii stau in grupul Organizatii. „Locatii salvate”
// a iesit din meniu pana exista cu adevarat (era doar un ecran „in pregatire”).
export const PERSONAL_NAV = [
  { key: "overview", label: "Prezentare generală", shortLabel: "Acasă", icon: LayoutDashboard },
  { key: "requests", label: "Cererile mele", shortLabel: "Cereri", icon: FileText },
  { key: "settings", label: "Setări", shortLabel: "Setări", icon: Settings },
];

// O singura interfata de organizatie: spatiul de furnizor. Pana la aprobarea revendicarii,
// contul vede starea solicitarii active si istoricul tuturor solicitarilor de organizatie.
export function getApplicantNav({ hasActiveClaim = false } = {}) {
  return [
    ...(hasActiveClaim ? [{ key: "status", label: "Status solicitare", shortLabel: "Status", icon: FileText }] : []),
    { key: "history", label: "Toate solicitările", shortLabel: "Istoric", icon: History },
  ];
}

export function getProviderNav({
  canManageOrganizationProfile,
  canViewLocations,
  canManageRequests,
  canManageMembers,
  canManageSettings,
}) {
  const nav = [
    { key: "overview", label: "Prezentare generală", shortLabel: "Acasă", icon: LayoutDashboard },
  ];
  if (canManageOrganizationProfile) nav.push({ key: "profile", label: "Profil public", shortLabel: "Profil", icon: Building2 });
  if (canViewLocations) nav.push({ key: "locations", label: "Locații", shortLabel: "Locații", icon: Building2 });
  if (canManageRequests) nav.push({ key: "leads", label: "Cereri", shortLabel: "Cereri", icon: Inbox });
  // 2026-10-03. „Echipă” intră in meniu: cine lucreaza in contul organizatiei si cine apare public
  // ca specialist. Inainte era ascunsa in Setari si in avatarele din antet.
  if (canManageMembers) nav.push({ key: "access", label: "Echipă", shortLabel: "Echipă", icon: Users });
  if (canManageSettings) nav.push({ key: "settings", label: "Setări", shortLabel: "Setări", icon: Settings });
  return nav;
}
