import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DraftBadge from "../DraftBadge";
import { AVAILABILITY_OPTIONS } from "@/lib/providerTaxonomy";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none";

export default function ApplicantHoursDraft({ workspace, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({ opening_hours: "", saturday_hours: "", availability_status: "necunoscuta" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const existing = (workspace.preparation_drafts || []).find((d) => d.section === "operating_hours");
    setDraft(existing || null);
    if (existing) setValues({ availability_status: "necunoscuta", ...JSON.parse(existing.payload_json || "{}") });
  }, [workspace]);

  const save = async () => {
    setSaving(true); setMsg("");
    const action = draft ? "update_draft" : "create_draft";
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: draft?.id, section: "operating_hours", payload: values, claim_request_id: workspace.claim?.id,
    }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat.");
    onRefresh();
  };

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Program</h1>
      <DraftBadge />
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Program normal</label>
          <input className={inputCls} value={values.opening_hours} onChange={(e) => setValues({ ...values, opening_hours: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Program sambata</label>
          <input className={inputCls} value={values.saturday_hours} onChange={(e) => setValues({ ...values, saturday_hours: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Disponibilitate</label>
          <select className={inputCls} value={values.availability_status} onChange={(e) => setValues({ ...values, availability_status: e.target.value })}>
            <option value="necunoscuta">Disponibilitate nepublicata</option>
            {Object.entries(AVAILABILITY_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button disabled={saving} onClick={save} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
          Salveaza draft
        </button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}