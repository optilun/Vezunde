import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DraftBadge from "../DraftBadge";
import { SERVICE_GROUPS, CLAIM_PREP_SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";

export default function ApplicantServicesDraft({ workspace, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const existing = (workspace.preparation_drafts || []).find((d) => d.section === "services");
    setDraft(existing || null);
    const payload = existing ? JSON.parse(existing.payload_json || "{}") : {};
    setSelected(payload.selected_ids || {});
  }, [workspace]);

  const toggle = (group, id) => {
    const current = new Set(selected[group] || []);
    current.has(id) ? current.delete(id) : current.add(id);
    setSelected({ ...selected, [group]: [...current] });
  };

  const save = async () => {
    setSaving(true); setMsg("");
    const action = draft ? "update_draft" : "create_draft";
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: draft?.id, section: "services", claim_request_id: workspace.claim?.id,
      payload: { selected_ids: selected },
    }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat.");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Servicii</h1>
      <DraftBadge />
      {CLAIM_PREP_SERVICE_GROUPS.map((group) => (
        <div key={group} className="rounded-xl border border-border bg-card p-4">
          <div className="font-semibold text-sm mb-2">{SERVICE_GROUPS[group].label}</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SERVICE_GROUPS[group].ids).map(([id, label]) => (
              <button key={id} onClick={() => toggle(group, id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${(selected[group] || []).includes(id) ? "bg-foreground text-white border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button disabled={saving} onClick={save} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
        Salveaza draft
      </button>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}