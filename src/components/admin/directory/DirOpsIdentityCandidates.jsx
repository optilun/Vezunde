import React from "react";

const SEV = {
  strong_duplicate: { label: "Duplicat puternic", cls: "bg-destructive/10 text-destructive" },
  possible_duplicate: { label: "Posibil duplicat", cls: "bg-amber-100 text-amber-800" },
  likely_distinct: { label: "Probabil distinct", cls: "bg-secondary text-muted-foreground" },
};

// Module 3H.1B.1: admin creation gate — candidate cards + explicit override.
export default function DirOpsIdentityCandidates({ check, reason, setReason, saving, onContinue, onCancel }) {
  const strong = check.blocking_level === "strong_duplicate_review_required";
  const reasonOk = reason.trim().length >= 15;
  return (
    <div className="mt-6 border border-destructive/40 bg-destructive/5 rounded-lg p-4">
      <p className="font-semibold text-sm">
        {strong
          ? "Duplicat puternic detectat — crearea normala este blocata."
          : "Posibile duplicate gasite — continuarea necesita un motiv."}
      </p>
      <ul className="mt-3 space-y-2">
        {check.candidates.map((c) => (
          <li key={c.location_id} className="rounded-md border border-border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{c.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${SEV[c.severity]?.cls || ""}`}>{SEV[c.severity]?.label || c.severity}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {c.organization_name ? `${c.organization_name} · ` : ""}
              {c.locality_name}{c.county_name ? `, ${c.county_name}` : ""}{c.address ? ` · ${c.address}` : ""} · {c.profile_control_status}
            </div>
            {c.matched_fields?.length > 0 && <div className="text-xs mt-1">Potrivire: {c.matched_fields.join(", ")}</div>}
          </li>
        ))}
      </ul>
      <label className="block text-xs font-semibold text-muted-foreground mt-4 mb-1">
        Motiv pentru crearea ca locatie diferita (minim 15 caractere) *
      </label>
      <textarea className="w-full border border-input rounded-md px-3 py-2 text-sm bg-card" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-3 mt-3">
        {strong ? (
          <button onClick={() => onContinue(true)} disabled={saving || !reasonOk} className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-40">
            Creeaza totusi ca locatie diferita
          </button>
        ) : (
          <button onClick={() => onContinue(false)} disabled={saving || !reasonOk} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
            Continua cu motiv
          </button>
        )}
        <button onClick={onCancel} className="px-4 py-2 rounded-md bg-secondary text-sm">Anuleaza</button>
      </div>
    </div>
  );
}