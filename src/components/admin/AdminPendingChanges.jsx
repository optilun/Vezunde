import React, { useState } from "react";

function parseChanges(raw) {
  try { return JSON.parse(raw) || {}; } catch (_e) { return {}; }
}

export default function AdminPendingChanges({ location, onDecision, busy }) {
  const [notes, setNotes] = useState("");
  const changes = parseChanges(location.pending_changes);
  const fields = changes.fields || {};

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="font-semibold">{location.name} <span className="text-xs text-muted-foreground font-normal">({location.city})</span></div>
      <div className="mt-2 text-sm space-y-1">
        {Object.entries(fields).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-muted-foreground">{k}:</span>
            <span className="line-through text-muted-foreground/70">{String(location[k] || "-")}</span>
            <span>→ {String(v)}</span>
          </div>
        ))}
        {Array.isArray(changes.services) && <div className="text-muted-foreground">Servicii noi: {changes.services.join(", ") || "niciunul"}</div>}
        {Array.isArray(changes.specializations) && <div className="text-muted-foreground">Specializari noi: {changes.specializations.join(", ") || "niciuna"}</div>}
        {Array.isArray(changes.facilities) && <div className="text-muted-foreground">Dotari noi: {changes.facilities.join(", ") || "niciuna"}</div>}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Note (optional)"
        rows={2}
        className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
      />
      <div className="mt-3 flex gap-2">
        <button disabled={busy} onClick={() => onDecision(location, "aproba", notes)} className="px-4 py-2 rounded-full text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
          Aproba modificarile
        </button>
        <button disabled={busy} onClick={() => onDecision(location, "respinge", notes)} className="px-4 py-2 rounded-full text-xs font-semibold border border-border disabled:opacity-50">
          Respinge
        </button>
      </div>
    </div>
  );
}