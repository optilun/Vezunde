import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DraftBadge from "../DraftBadge";

const FIELDS = [
  ["public_description", "Descriere publica", "textarea"],
  ["public_phone", "Telefon public", "text"],
  ["public_email", "Email public", "text"],
  ["website_url", "Website", "text"],
  ["facebook_url", "Facebook", "text"],
  ["instagram_url", "Instagram", "text"],
  ["linkedin_url", "LinkedIn", "text"],
];

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none";

export default function ApplicantProfileDraft({ workspace, onRefresh }) {
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const existing = (workspace.preparation_drafts || []).find((d) => d.section === "public_profile");
    setDraft(existing || null);
    setValues(existing ? JSON.parse(existing.payload_json || "{}") : {});
  }, [workspace]);

  const save = async () => {
    setSaving(true); setMsg("");
    const action = draft ? "update_draft" : "create_draft";
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: draft?.id, section: "public_profile", payload: values, claim_request_id: workspace.claim?.id,
    }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat.");
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public</h1>
      <DraftBadge />
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        {FIELDS.map(([key, label, type]) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground">{label}</label>
            {type === "textarea" ? (
              <textarea className={inputCls} rows={3} value={values[key] || ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
            ) : (
              <input className={inputCls} value={values[key] || ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
            )}
          </div>
        ))}
        <button disabled={saving} onClick={save} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
          Salveaza draft
        </button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}