import React, { useState } from "react";
import AdminClaimIdentityContext from "@/components/admin/AdminClaimIdentityContext";

export default function AdminClaimCard({ claim, onDecision, busy }) {
  const [notes, setNotes] = useState("");
  // Module 3H.1B.2: duplicate-review requests have no location — never approvable here.
  const isDuplicateReview = claim.mode === "new_location_duplicate_review";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{claim.business_name || "Fara nume"}</div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isDuplicateReview ? "bg-red-100 text-red-800 font-semibold" : "bg-secondary"}`}>
          {isDuplicateReview ? "Locatie noua — verificare duplicat" : claim.mode === "new_location" ? "Locatie noua" : "Revendicare"}
        </span>
      </div>
      <div className="mt-2 text-sm text-muted-foreground space-y-0.5">
        <div>Contact: {claim.contact_name}{claim.role ? ` (${claim.role})` : ""}</div>
        <div>Email: {claim.email}</div>
        {claim.phone && <div>Telefon: {claim.phone}</div>}
        <div>Trimisa: {new Date(claim.created_date).toLocaleDateString("ro-RO")}</div>
      </div>
      <AdminClaimIdentityContext claim={claim} />
      {isDuplicateReview && (
        <p className="mt-2 text-xs text-muted-foreground">
          Aceasta cerere nu creeaza nicio locatie. Daca este cu adevarat distincta, creeaza locatia doar prin fluxul canonic „Adauga locatie" (Operatiuni), apoi respinge sau cere clarificari aici.
        </p>
      )}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note de verificare (optional)"
        rows={2}
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
      />
      <div className="mt-3 flex gap-2">
        {!isDuplicateReview && (
          <button
            disabled={busy}
            onClick={() => onDecision(claim, "approve", notes)}
            className="px-4 py-2 rounded-full text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "#171717" }}
          >
            Aproba
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => onDecision(claim, "reject", notes)}
          className="px-4 py-2 rounded-full text-xs font-semibold border border-border disabled:opacity-50"
        >
          Respinge
        </button>
      </div>
    </div>
  );
}