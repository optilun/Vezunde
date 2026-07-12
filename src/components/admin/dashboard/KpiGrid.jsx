import React from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  Search,
  ShieldQuestion,
  UserCheck,
  Wrench,
} from "lucide-react";
import KpiCard from "./KpiCard";

export default function KpiGrid({ stats, onNavigate }) {
  const cards = [
    { icon: CheckCircle2, label: "Locatii publicate", value: stats.published, tab: "profiluri" },
    { icon: ClipboardCheck, label: "Coada de verificare", value: stats.reviewQueue, tab: "workspace_reviews" },
    { icon: UserCheck, label: "Revendicari in asteptare", value: stats.pendingClaims, tab: "revendicari" },
    { icon: Wrench, label: "Servicii neconfirmate", value: stats.unconfirmedServices, tab: "servicii" },
    { icon: Search, label: "Drafturi research active", value: stats.activeResearchDrafts, tab: "research" },
    { icon: ShieldQuestion, label: "Profiluri directory", value: stats.directoryProfiles, tab: "profiluri" },
    { icon: MapPin, label: "Acoperire judete", value: `${stats.countiesCovered}/${stats.totalCounties}`, tab: "geografie" },
    { icon: Activity, label: "Actiuni in 7 zile", value: stats.recentAuditCount, tab: "audit" },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          icon={card.icon}
          label={card.label}
          value={card.value}
          onClick={() => onNavigate(card.tab)}
        />
      ))}
    </div>
  );
}
