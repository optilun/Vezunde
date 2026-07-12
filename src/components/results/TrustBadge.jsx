import React from "react";
import { BadgeCheck } from "lucide-react";

// Module UI-1: single source of truth for public trust badges.
// Uses ONLY profile_control_status values already returned by the backend —
// never legacy is_verified / verification_state, never internal statuses.
const CONFIG = {
  verified: {
    label: "Profil verificat de Vezunde",
    className: "text-primary bg-accent border-transparent",
    Icon: BadgeCheck,
  },
  claimed: {
    label: "Profil revendicat",
    className: "text-foreground bg-transparent border-border",
  },
  directory: {
    label: "Profil din director",
    className: "text-muted-foreground bg-secondary border-transparent",
  },
};

export default function TrustBadge({ status, className = "", label }) {
  const cfg = CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 border shrink-0 ${cfg.className} ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label || cfg.label}
    </span>
  );
}
