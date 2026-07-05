import React from "react";
import AdminPageHeader from "@/components/admin/ui/AdminPageHeader";
import EmptyState from "@/components/admin/ui/EmptyState";
import { Settings } from "lucide-react";

// UI-1: honest placeholder — no settings functionality exists yet, so we do
// not invent any. Purely navigational, no backend behind it.
export default function AdminSettingsPlaceholder() {
  return (
    <div>
      <AdminPageHeader title="Setari" subtitle="Optiuni de configurare pentru spatiul de administrare." />
      <div className="mt-6 bg-card border border-border rounded-2xl shadow-sm">
        <EmptyState icon={Settings} title="Setarile vor fi disponibile in curand." subtitle="Aceasta sectiune este rezervata pentru configurari viitoare ale administrarii." />
      </div>
    </div>
  );
}