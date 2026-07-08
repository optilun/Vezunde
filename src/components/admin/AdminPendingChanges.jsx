import React, { useState } from "react";

function parseChanges(raw) {
  try { return JSON.parse(raw) || {}; } catch (_e) { return {}; }
}

function formatFieldLabel(key) {
  const labels = {
    photo_url: "Logo / imagine profil",
    public_display_name: "Nume public",
    address: "Adresa",
    phone_public: "Telefon public",
    public_email: "Email public",
    website: "Website",
    description: "Descriere",
    provider_type: "Tip furnizor",
  };
  return labels[key] || key;
}

function FieldChange({ location, fieldKey, value }) {
  const previous = String(location[fieldKey] || "-");
  if (fieldKey === "photo_url") {
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <div className="text-xs font-semibold text-muted-foreground">{formatFieldLabel(fieldKey)}</div>
        <div className="mt-2 flex items-center gap-4">
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Actual</div>
            {location[fieldKey] ? <img src={location[fieldKey]} alt="Logo actual" className="h-14 w-14 rounded-xl border border-border bg-white object-contain p-1" /> : <div className="h-14 w-14 rounded-xl border border-border bg-white text-[10px] text-muted-foreground flex items-center justify-center">fara logo</div>}
          </div>
          <div className="text-muted-foreground">→</div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-1">Propus</div>
            <img src={String(value)} alt="Logo propus" className="h-14 w-14 rounded-xl border border-border bg-white object-contain p-1" />
          </div>
        </div>
        <a href={String(value)} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold underline underline-offset-4">Deschide imaginea</a>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground">{formatFieldLabel(fieldKey)}:</span>
      <span className="line-through text-muted-foreground/70">{previous}</span>
      <span>→ {String(value)}</span>
    </div>
  );
}

export default function AdminPendingChanges({ location, onDecision, busy }) {
  const [notes, setNotes] = useState("");
  const changes = parseChanges(location.pending_changes);
  const fields = changes.fields || {};

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="font-semibold">{location.name} <span className="text-xs text-muted-foreground font-normal">({location.city})</span></div>
      <div className="mt-2 text-sm space-y-2">
        {Object.entries(fields).map(([k, v]) => <FieldChange key={k} location={location} fieldKey={k} value={v} />)}
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