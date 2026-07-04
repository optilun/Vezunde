import React from "react";

// Module UI-1: shared chip style for public-safe services, used consistently
// across result cards and the provider profile page.
export default function ServiceChip({ label }) {
  return (
    <span className="text-xs bg-secondary text-secondary-foreground rounded-full px-2.5 py-1">
      {label}
    </span>
  );
}