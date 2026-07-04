import React from "react";
import { BadgeCheck } from "lucide-react";
import { VERIFICATION_STATE_LABELS } from "@/lib/providerTaxonomy";

export default function AdminLocationRow({ location, onVerify, onSuspend, busy }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold flex items-center gap-1.5">
          {location.name}
          {location.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {location.city} · Status: {location.status} · {VERIFICATION_STATE_LABELS[location.verification_state || "unclaimed"]}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {location.verification_state !== "verified" && (
          <button
            disabled={busy}
            onClick={() => onVerify(location)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#171717" }}
          >
            Verifica
          </button>
        )}
        {location.verification_state !== "suspended" && (
          <button
            disabled={busy}
            onClick={() => onSuspend(location)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border border-destructive text-destructive disabled:opacity-50"
          >
            Suspenda
          </button>
        )}
      </div>
    </div>
  );
}