import React from "react";
import { Building2, ClipboardCheck, Search, UserCheck } from "lucide-react";
import AdminCard from "@/components/admin/ui/AdminCard";

export default function QuickActionsGrid({ onNavigate }) {
  const actions = [
    { icon: ClipboardCheck, label: "Deschide coada de verificare", tab: "workspace_reviews" },
    { icon: Building2, label: "Adauga organizatie / locatie", tab: "adauga" },
    { icon: Search, label: "Continua research-ul", tab: "research" },
    { icon: UserCheck, label: "Verifica revendicarile", tab: "revendicari" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {actions.map((action) => (
        <AdminCard key={action.label} className="p-0">
          <button
            type="button"
            onClick={() => onNavigate(action.tab)}
            className="flex h-full w-full flex-col items-start gap-2 rounded-2xl p-4 text-left transition-colors hover:bg-secondary"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <action.icon className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="text-sm font-semibold">{action.label}</span>
          </button>
        </AdminCard>
      ))}
    </div>
  );
}
