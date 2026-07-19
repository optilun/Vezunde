import React from "react";
import { Building2, CalendarDays, MapPinned } from "lucide-react";

const STATUS = {
  in_asteptare: { label: "In verificare", cls: "bg-secondary text-foreground" },
  needs_more_info: { label: "Necesita informatii suplimentare", cls: "bg-amber-100 text-amber-800" },
  aprobata: { label: "Aprobata", cls: "bg-green-100 text-green-800" },
  respinsa: { label: "Respinsa", cls: "bg-destructive/10 text-destructive" },
};

const SCOPE_LABELS = {
  location: "O locatie",
  selected_locations: "Mai multe locatii",
  organization: "Organizatie",
};

const parsePayload = (raw) => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const claimTypeLabel = (claim, payload) => {
  if (payload.scope_contract_version && payload.claim_scope) return `Revendicare · ${SCOPE_LABELS[payload.claim_scope] || payload.claim_scope}`;
  if (payload.request_type === "access_request_existing_claimed_profile") return "Cerere acces profil administrat";
  if (claim.mode === "new_location_duplicate_review") return "Verificare locatie similara";
  if (claim.mode === "new_location") return "Locatie noua";
  return "Revendicare profil";
};

export default function ClaimStatusRow({ claim }) {
  const status = STATUS[claim.status] || STATUS.in_asteptare;
  const createdDate = claim.created_date ? new Date(claim.created_date).toLocaleDateString("ro-RO") : "data necunoscuta";
  const payload = parsePayload(claim.submitted_payload);
  const requestedCount = Array.isArray(payload.requested_location_ids) ? payload.requested_location_ids.length : (claim.location_id ? 1 : 0);
  const approvedCount = Array.isArray(payload.approved_location_ids) ? payload.approved_location_ids.length : (claim.status === "aprobata" ? requestedCount : 0);

  return (
    <article className="rounded-[20px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Building2 className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="break-words text-sm font-bold">{claim.business_name || "Locatie"}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{claimTypeLabel(claim, payload)}</div>
            {payload.scope_contract_version && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <MapPinned className="h-3.5 w-3.5" />
                {claim.status === "aprobata"
                  ? `${approvedCount} ${approvedCount === 1 ? "locatie aprobata" : "locatii aprobate"}`
                  : `${requestedCount} ${requestedCount === 1 ? "locatie solicitata" : "locatii solicitate"}`}
              </div>
            )}
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Trimisa {createdDate}</div>
          </div>
        </div>
        <span className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>

      {payload.reported_missing_location && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/35 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Locatie lipsa raportata: {payload.reported_missing_location}
        </div>
      )}
      {claim.status === "needs_more_info" && claim.review_notes && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800">Completare necesara: {claim.review_notes}</div>
      )}
      {claim.status === "respinsa" && claim.review_notes && (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-destructive">Motiv: {claim.review_notes}</div>
      )}
      {claim.status === "aprobata" && requestedCount > approvedCount && (
        <div className="mt-4 rounded-xl border border-border bg-secondary/35 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Aprobarea este partiala: ai acces numai la locatiile confirmate de VIASEE.
        </div>
      )}
    </article>
  );
}
