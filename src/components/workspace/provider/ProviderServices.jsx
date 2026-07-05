import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

export default function ProviderServices({ locationId, overview, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "services" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    setDraft(own || null);
    setSelected(own ? (JSON.parse(own.payload_json || "{}").selected_ids || {}) : {});
  };

  useEffect(() => { load(); }, [locationId]);

  const toggle = (group, id) => {
    if (draft?.status === "pending_review") return;
    const current = new Set(selected[group] || []);
    current.has(id) ? current.delete(id) : current.add(id);
    setSelected({ ...selected, [group]: [...current] });
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: draft?.id, location_id: locationId, section: "services", payload: { selected_ids: selected },
    }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Salvat.");
    load(); onRefresh();
  };

  const submit = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "services" }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Trimis spre review.");
    load(); onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Servicii si activitati</h1>
        <span className="text-xs text-muted-foreground">{overview.content_summary.approved_service_count} publicate</span>
      </div>
      {draft && <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
      <p className="text-xs text-muted-foreground">Adaugarea unui serviciu nu modifica clasarea sau verificarea profilului.</p>
      {Object.entries(SERVICE_GROUPS).map(([group, def]) => (
        <div key={group} className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-2">{def.label}</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(def.ids).map(([id, label]) => (
              <button key={id} disabled={draft?.status === "pending_review"} onClick={() => toggle(group, id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border disabled:opacity-50 ${(selected[group] || []).includes(id) ? "bg-foreground text-white border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button disabled={saving || draft?.status === "pending_review"} onClick={save} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border disabled:opacity-50">Salveaza draft</button>
        {draft && draft.status !== "pending_review" && (
          <button disabled={saving} onClick={submit} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>Trimite spre review</button>
        )}
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}