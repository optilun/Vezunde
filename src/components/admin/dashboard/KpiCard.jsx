import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";

// UI-1 PART 2: single KPI card — icon, label, value, supporting text.
export default function KpiCard({ icon: Icon, label, value, hint, onClick }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <AdminCard className={`p-4 text-left ${onClick ? "hover:border-foreground/20 transition-colors" : ""}`}>
      <Wrapper onClick={onClick} className="w-full text-left">
        <div className="flex items-center justify-between">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Icon className="w-4 h-4 text-accent-foreground" />
          </div>
        </div>
        <div className="mt-3 text-2xl font-heading font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground/80 mt-1">{hint}</div>}
      </Wrapper>
    </AdminCard>
  );
}