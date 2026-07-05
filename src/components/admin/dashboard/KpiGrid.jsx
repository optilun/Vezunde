import React from "react";
import { CheckCircle2, ShieldQuestion, UserCheck, Wrench, Sparkles, AlertTriangle, MapPin, Activity } from "lucide-react";
import KpiCard from "./KpiCard";

// UI-1 PART 2: 8 KPI cards, all backed by real counts computed by the parent.
export default function KpiGrid({ stats, onNavigate }) {
  const cards = [
    { icon: CheckCircle2, label: "Locatii publicate", value: stats.published, tab: "profiluri" },
    { icon: ShieldQuestion, label: "Profiluri de verificat", value: stats.toVerify, tab: "profiluri" },
    { icon: UserCheck, label: "Revendicari in asteptare", value: stats.pendingClaims, tab: "revendicari" },
    { icon: Wrench, label: "Servicii neconfirmate", value: stats.unconfirmedServices, tab: "servicii" },
    { icon: Sparkles, label: "Drafturi AI in review", value: stats.draftsInReview, tab: "ai" },
    { icon: AlertTriangle, label: "Profiluri incomplete", value: stats.incompleteProfiles, tab: "profiluri" },
    { icon: MapPin, label: "Acoperire judete", value: `${stats.countiesCovered}/${stats.totalCounties}`, tab: "geografie" },
    { icon: Activity, label: "Activitati recente", value: stats.recentActivityCount, tab: "audit" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
      {cards.map((c) => (
        <KpiCard key={c.label} icon={c.icon} label={c.label} value={c.value} onClick={() => onNavigate(c.tab)} />
      ))}
    </div>
  );
}