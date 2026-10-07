import React from "react";
import AdminHint from "@/components/admin/ui/AdminHint";

// UI-1: consistent page header used across every admin section.
// 2026-10-07: subtitlul rămâne o singură linie scurtă; explicațiile lungi merg în `hint` (ⓘ).
export default function AdminPageHeader({ title, subtitle = undefined, actions = undefined, hint = undefined }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
          {hint && <AdminHint>{hint}</AdminHint>}
        </div>
        {subtitle && <p className="mt-1 max-w-xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
