import React from "react";
import { PlusCircle, Sparkles, UserCheck, Building2 } from "lucide-react";
import AdminCard from "@/components/admin/ui/AdminCard";

// UI-1 PART 3.F — 4 quick action cards, navigate to existing pages only.
export default function QuickActionsGrid({ onNavigate }) {
  const actions = [
    { icon: PlusCircle, label: "Adauga locatie", tab: "adauga" },
    { icon: Sparkles, label: "Ruleaza research", tab: "ai" },
    { icon: UserCheck, label: "Verifica revendicari", tab: "revendicari" },
    { icon: Building2, label: "Vezi profiluri incomplete", tab: "profiluri" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {actions.map((a) => (
        <AdminCard key={a.label} className="p-0">
          <button onClick={() => onNavigate(a.tab)} className="w-full h-full flex flex-col items-start gap-2 p-4 text-left hover:bg-secondary transition-colors rounded-2xl">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center"><a.icon className="w-4 h-4 text-accent-foreground" /></div>
            <span className="text-sm font-semibold">{a.label}</span>
          </button>
        </AdminCard>
      ))}
    </div>
  );
}