import React from "react";
import { cn } from "@/lib/utils";

// Insigna de stare comună pentru tot panoul de admin (2026-10-07). Înlocuiește cele 12 copii locale
// (StatusBadge/Badge/Tag/FollowUpBadge) și clasele de culoare scrise de mână: tonurile vin din
// tokenii semantici din index.css (success / warning / info / danger).
const TONES = {
  neutral: "border-border bg-secondary text-muted-foreground",
  success: "border-success-border bg-success-soft text-success",
  warning: "border-warning-border bg-warning-soft text-warning",
  info: "border-info-border bg-info-soft text-info",
  danger: "border-danger-border bg-danger-soft text-danger",
};

// Denumiri vechi, păstrate ca ecranele neschimbate încă să nu se strice.
const ALIASES = { green: "success", amber: "warning", blue: "info", red: "danger" };

export default function StatusBadge({ label, tone = "neutral", icon: Icon, className = "", children }) {
  const key = TONES[tone] ? tone : ALIASES[tone] || "neutral";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-5",
        TONES[key],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children ?? label}
    </span>
  );
}
