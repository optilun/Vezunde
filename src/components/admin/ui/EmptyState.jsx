import React from "react";
import { Inbox } from "lucide-react";

// UI-1 PART 4: premium, honest empty states — no fake charts or dummy rows.
export default function EmptyState({ title, subtitle, ctaLabel, onCta, icon: Icon = Inbox }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mx-auto">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">{subtitle}</p>}
      {ctaLabel && (
        <button onClick={onCta} className="mt-4 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}