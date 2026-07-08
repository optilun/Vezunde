import React from "react";

const STATUS = {
  in_asteptare: { label: "In verificare", cls: "bg-secondary text-foreground" },
  needs_more_info: { label: "Necesita informatii suplimentare", cls: "bg-amber-100 text-amber-800" },
  aprobata: { label: "Aprobata", cls: "bg-green-100 text-green-800" },
  respinsa: { label: "Respinsa", cls: "bg-destructive/10 text-destructive" },
};

const parsePayload = (raw) => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const claimTypeLabel = (claim) => {
  const payload = parsePayload(claim.submitted_payload);
  if (payload.request_type === "access_request_existing_claimed_profile") return "Cerere acces profil administrat";
  if (claim.mode === "new_location_duplicate_review") return "Verificare locatie similara";
  if (claim.mode === "new_location") return "Locatie noua";
  return "Revendicare profil";
};

export default function ClaimStatusRow({ claim }) {
  const s = STATUS[claim.status] || STATUS.in_asteptare;
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
      <div>
        <div className="font-semibold text-sm">{claim.business_name || "Locatie"}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {claimTypeLabel(claim)} · trimisa {new Date(claim.created_date).toLocaleDateString("ro-RO")}
        </div>
        {claim.status === "needs_more_info" && claim.review_notes && (
          <div className="text-xs text-amber-700 mt-1">Completare necesara: {claim.review_notes}</div>
        )}
        {claim.status === "respinsa" && claim.review_notes && (
          <div className="text-xs text-destructive mt-1">Motiv: {claim.review_notes}</div>
        )}
      </div>
      <span className={`text-xs font-semibold px-3 py-1 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
    </div>
  );
}