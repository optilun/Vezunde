import React from "react";
import { BadgeCheck, CheckCircle2, CreditCard, Inbox } from "lucide-react";
import KpiCard from "./KpiCard";

export default function KpiGrid({ stats, onNavigate }) {
  const cards = [
    { icon: CheckCircle2, label: "Locații publicate", value: stats.published, tab: "profiluri" },
    { icon: Inbox, label: "Cereri pacienți (7 zile)", value: stats.patientRequests, tab: "contacte_pacienti" },
    { icon: CreditCard, label: "Conturi Pro active", value: stats.proAccounts, tab: "billing" },
    { icon: BadgeCheck, label: "Profiluri revendicate", value: stats.claimedProfiles, tab: "profiluri" },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} icon={card.icon} label={card.label} value={card.value} onClick={() => onNavigate(card.tab)} />
      ))}
    </div>
  );
}