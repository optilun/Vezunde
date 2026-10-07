import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import { cn } from "@/lib/utils";

const ICON_TONES = {
  neutral: "bg-secondary text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  danger: "bg-danger-soft text-danger",
};

// Contor compact comun (2026-10-07): înlocuiește SummaryCard/StatTile copiate prin ecrane.
// `value` null/undefined = indisponibil, se afișează „—” (nu 0).
export default function StatCard({ icon: Icon = undefined, label, value, hint = undefined, tone = "neutral", onClick = undefined, active = false }) {
  const unavailable = value === null || value === undefined;
  const Wrapper = onClick ? "button" : "div";
  const wrapperProps = onClick ? { type: /** @type {"button"} */ ("button"), onClick, "aria-pressed": active || undefined } : {};
  return (
    <AdminCard className={cn("overflow-hidden", active && "border-foreground")}>
      <Wrapper
        {...wrapperProps}
        className={cn("flex w-full items-center justify-between gap-3 p-4 text-left", onClick && "transition-colors hover:bg-secondary/40")}
      >
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
          <span className="mt-1 block font-heading text-2xl font-extrabold tabular-nums" title={unavailable ? "Indisponibil acum" : undefined}>
            {unavailable ? "—" : value}
          </span>
          {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
        </span>
        {Icon && (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", ICON_TONES[tone] || ICON_TONES.neutral)}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </Wrapper>
    </AdminCard>
  );
}
