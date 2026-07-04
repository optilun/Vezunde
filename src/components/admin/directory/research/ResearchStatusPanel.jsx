import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { RESEARCH_STATUS_LABELS } from "@/lib/researchCatalog";

const input = "w-full border border-input rounded-md px-2.5 py-1.5 text-sm bg-card";

export default function ResearchStatusPanel({ location, onReload }) {
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [recheck, setRecheck] = useState("");
  const [assignee, setAssignee] = useState(location.research_assigned_to || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const call = async (payload) => {
    setSaving(true);
    setError(null);
    try {
      await base44.functions.invoke("researchOps", payload);
      setNote("");
      setStatus("");
      await onReload();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setSaving(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-heading font-bold text-sm">H. Status research</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Status curent: <span className="font-semibold text-foreground">{RESEARCH_STATUS_LABELS[location.research_status || "new"]}</span>
        {location.research_assigned_to ? ` · Responsabil: ${location.research_assigned_to}` : ""}
        {location.next_recheck_at ? ` · Re-verificare: ${location.next_recheck_at.slice(0, 10)}` : ""}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Schimba status...</option>
          {Object.entries(RESEARCH_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className={input} value={recheck} onChange={(e) => setRecheck(e.target.value)} title="Data re-verificare (optional)" />
      </div>
      <textarea className={`${input} mt-2`} rows={2} placeholder="Nota (obligatorie pentru respins / re-verificare)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button
        onClick={() => call({ action: "set_research_status", location_id: location.id, status, note, next_recheck_at: recheck ? new Date(recheck).toISOString() : "" })}
        disabled={saving || !status}
        className="mt-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40"
      >
        Aplica status
      </button>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Statusul de research este intern si nu schimba statusul public al profilului.
      </p>

      <div className="mt-4 flex gap-2">
        <input className={input} placeholder="Email responsabil research" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
        <button
          onClick={() => call({ action: "assign_research", location_id: location.id, assigned_to: assignee })}
          disabled={saving}
          className="px-3 py-1.5 rounded-md bg-secondary text-xs font-semibold shrink-0"
        >
          Atribuie
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}