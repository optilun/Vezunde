import React from "react";
import AdminSupportTickets from "@/components/admin/support/AdminSupportTickets";
import AdminUserFeedback from "@/components/admin/support/AdminUserFeedback";
import AdminTabs from "@/components/admin/ui/AdminTabs";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { useAdminSubTab } from "@/components/admin/useAdminRoute";

// 2026-10-07: numerele vin din aceleași numărători ca meniul și Panoul (nu mai citește 2 x 500 de
// înregistrări doar ca să le numere), iar cele două vederi sunt taburi compacte, pe adresă.
export default function AdminSupportCenter({ adminUser }) {
  const { counts } = useAdminCounts();
  const [view, setView] = useAdminSubTab(["tickets", "feedback"], "tickets");

  const tabs = [
    { key: "tickets", label: "Tichete de suport", count: counts?.tickets ?? null },
    { key: "feedback", label: "Feedback utilizatori", count: counts?.feedback ?? null },
  ];

  return (
    <div className="space-y-4">
      <AdminTabs tabs={tabs} value={view} onChange={setView} label="Suport" />
      {view === "tickets" ? <AdminSupportTickets adminUser={adminUser} /> : <AdminUserFeedback />}
    </div>
  );
}
