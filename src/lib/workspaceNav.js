import { LayoutDashboard, FileText, Bookmark, User, Settings, Building2, Wrench, Users, Clock, Image, Newspaper, Shield } from "lucide-react";

export const PERSONAL_NAV = [
  { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
  { key: "requests", label: "Solicitarile mele", icon: FileText },
  { key: "saved", label: "Locatii salvate", icon: Bookmark },
  { key: "data", label: "Datele mele", icon: User },
  { key: "settings", label: "Setari", icon: Settings },
];

export const APPLICANT_NAV = [
  { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
  { key: "profile", label: "Profil public", icon: Building2 },
  { key: "hours", label: "Program", icon: Clock },
  { key: "services", label: "Servicii", icon: Wrench },
  { key: "status", label: "Status solicitare", icon: FileText },
];

export function getProviderNav({ canManageMembers }) {
  const nav = [
    { key: "overview", label: "Prezentare generala", icon: LayoutDashboard },
    { key: "profile", label: "Profil public", icon: Building2 },
    { key: "locations", label: "Locatii", icon: Building2 },
    { key: "services", label: "Servicii si activitati", icon: Wrench },
    { key: "team", label: "Echipa", icon: Users },
    { key: "hours", label: "Program", icon: Clock },
    { key: "media", label: "Fotografii", icon: Image },
    { key: "articles", label: "Articole", icon: Newspaper },
  ];
  if (canManageMembers) nav.push({ key: "access", label: "Acces si utilizatori", icon: Shield });
  nav.push({ key: "settings", label: "Setari", icon: Settings });
  return nav;
}