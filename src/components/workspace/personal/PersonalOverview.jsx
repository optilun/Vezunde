import React from "react";
import { Link } from "react-router-dom";
import { CLAIM_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

export default function PersonalOverview({ user, workspace, onNavigate }) {
  const latest = workspace?.latest_claim_status;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">Salut, {user.full_name || "acolo"}</h1>
        <p className="mt-2 text-muted-foreground text-sm">Contul tau personal VIASEE.</p>
      </div>

      {latest && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">Ultima solicitare de furnizor</div>
            <div className="text-xs text-muted-foreground mt-0.5">{CLAIM_STATUS_LABELS[latest.status] || latest.status}</div>
          </div>
          <button onClick={() => onNavigate("requests")} className="text-xs font-semibold underline underline-offset-4 shrink-0">Vezi</button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-accent/40 p-5">
        <div className="font-semibold text-sm">Reprezinti o locatie?</div>
        <p className="text-xs text-muted-foreground mt-1">Adauga sau revendica un profil pentru locatia ta.</p>
        <Link to="/adauga-sau-revendica" className="mt-3 inline-block px-5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: "#171717" }}>
          Adauga sau revendica un profil
        </Link>
      </div>
    </div>
  );
}
