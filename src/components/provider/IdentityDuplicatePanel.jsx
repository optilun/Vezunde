import React, { useState } from "react";

// Module 3H.1B.1: provider new-location gate — safe candidate cards only.
export default function IdentityDuplicatePanel({ check, submitting, onClaim, onContinueDistinct, onCancel }) {
  const strong = check.blocking_level === "strong_duplicate_review_required";
  const [showNote, setShowNote] = useState(!strong);
  const [note, setNote] = useState("");
  const noteOk = note.trim().length >= 15;

  return (
    <div className="text-left">
      <p className="text-sm font-semibold">
        {check.message || (strong
          ? "Am gasit un profil foarte asemanator. Verifica daca este deja locatia ta."
          : "Am gasit profiluri asemanatoare. Confirma ca este o locatie diferita.")}
      </p>
      <div className="mt-4 space-y-3">
        {check.candidates.map((c) => (
          <div key={c.location_id} className="rounded-xl border border-border bg-card p-4">
            <div className="font-semibold text-sm">{c.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {c.organization_name ? `${c.organization_name} · ` : ""}
              {c.locality_name}{c.county_name ? `, ${c.county_name}` : ""}{c.address ? ` · ${c.address}` : ""}
            </div>
            {c.matched_fields?.length > 0 && (
              <div className="text-xs text-muted-foreground mt-1">Potrivire: {c.matched_fields.join(", ")}</div>
            )}
            {strong && c.severity === "strong_duplicate" && (
              <button type="button" onClick={() => onClaim(c)} className="mt-3 px-4 py-2 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: "#171717" }}>
                Revendica acest profil
              </button>
            )}
          </div>
        ))}
      </div>
      {strong && !showNote && (
        <button type="button" onClick={() => setShowNote(true)} className="mt-4 text-sm underline underline-offset-4">
          Este o locatie diferita
        </button>
      )}
      {showNote && (
        <div className="mt-4">
          <label className="block text-xs font-semibold text-muted-foreground mb-1">
            Explica pe scurt de ce este o locatie diferita (minim 15 caractere) *
          </label>
          <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          {strong && (
            <p className="mt-2 text-xs text-muted-foreground">
              Cererea va fi analizata manual de echipa Vezunde. Profilul nu va fi creat sau publicat pana la clarificare.
            </p>
          )}
          <button type="button" disabled={!noteOk || submitting} onClick={() => onContinueDistinct(note.trim())} className="mt-3 px-5 py-2.5 rounded-full border border-border bg-card text-sm font-semibold disabled:opacity-40">
            {submitting ? "Se trimite..." : strong ? "Trimite spre clarificare" : "Continua — este o locatie diferita"}
          </button>
        </div>
      )}
      <button type="button" onClick={onCancel} className="mt-4 block text-xs text-muted-foreground underline underline-offset-4">
        Inapoi la formular
      </button>
    </div>
  );
}