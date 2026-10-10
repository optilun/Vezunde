import React from "react";
import { BadgeCheck, CheckCircle2, CreditCard, Inbox } from "lucide-react";
import KpiCard from "./KpiCard";

// `stats` poate fi null cât timp se încarcă: cardurile arată „—”, nu 0.
export default function KpiGrid({ stats, onNavigate }) {
  const cards = [
    { icon: CheckCircle2, label: "Locații publicate", value: stats?.published, section: "profiluri" },
    // 2026-10-10: duce la „Cereri pacienți” (aceeași entitate pe care o numără), nu la contactele din căutări.
    { icon: Inbox, label: "Cereri pacienți (7 zile)", value: stats?.patientRequests, section: "cereri_pacienti" },
    { icon: CreditCard, label: "Conturi Pro active", value: stats?.proAccounts, section: "billing" },
    { icon: BadgeCheck, label: "Profiluri revendicate", value: stats?.claimedProfiles, section: "profiluri" },
  ];

  return (
    <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} icon={card.icon} label={card.label} value={card.value} onClick={() => onNavigate(card.section)} />
      ))}
    </div>
  );
}
