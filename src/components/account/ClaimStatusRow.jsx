import React from "react";

const STATUS = {
  in_asteptare: { label: "In verificare", cls: "bg-secondary text-foreground" },
  aprobata: { label: "Aprobata", cls: "bg-green-100 text-green-800" },
  respinsa: { label: "Respinsa", cls: "bg-destructive/10 text-destructive" },
};

export default function ClaimStatusRow({ claim }) {
  const s = STATUS[claim.status] || STATUS.in_asteptare;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-sm">{claim.business_name || "Locatie"}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {claim.mode === "new_location" ? "Locatie noua" : "Revendicare profil"} · trimisa {new Date(claim.created_date).toLocaleDateString("ro-RO")}
        </div>
        {claim.status === "respinsa" && claim.review_notes && (
          <div className="text-xs text-destructive mt-1">Motiv: {claim.review_notes}</div>
        )}
      </div>
      <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
    </div>
  );
}