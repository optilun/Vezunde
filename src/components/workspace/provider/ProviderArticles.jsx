import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none";

export default function ProviderArticles({ locationId }) {
  const [drafts, setDrafts] = useState([]);
  const [published, setPublished] = useState([]);
  const [form, setForm] = useState({ title: "", excerpt: "", body: "" });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [mineRes, publicRes] = await Promise.all([
      base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } })),
      base44.functions.invoke("getPublicProviderContent", { location_id: locationId }).catch(() => ({ data: { articles: [] } })),
    ]);
    setDrafts((mineRes.data?.submissions || []).filter((s) => s.section === "article"));
    setPublished(publicRes.data?.articles || []);
  };

  useEffect(() => { load(); }, [locationId]);

  const createArticle = async () => {
    if (!form.title.trim() || !form.body.trim()) { setMsg("Titlul si continutul sunt obligatorii."); return; }
    setCreating(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "create_draft", location_id: locationId, section: "article", payload: form }).catch((e) => ({ data: { error: e.message } }));
    setCreating(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setForm({ title: "", excerpt: "", body: "" });
    setMsg("Articol salvat ca draft.");
    load();
  };

  const submitArticle = async (id) => {
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: id, location_id: locationId, section: "article" }).catch((e) => ({ data: { error: e.message } }));
    if (res.data?.error) { setMsg(res.data.error); return; }
    load();
  };

  const withdrawArticle = async (id) => {
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "withdraw", submission_id: id, location_id: locationId, section: "article" }).catch((e) => ({ data: { error: e.message } }));
    if (res.data?.error) { setMsg(res.data.error); return; }
    load();
  };

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Articole</h1>
      <p className="text-xs text-muted-foreground">Articolele sunt verificate inainte de publicare.</p>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="font-semibold text-sm">Articol nou</div>
        <input className={inputCls} placeholder="Titlu" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className={inputCls} placeholder="Rezumat" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
        <textarea className={inputCls} rows={6} placeholder="Continut (text simplu)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <button disabled={creating} onClick={createArticle} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>Salveaza draft</button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </div>

      <div className="space-y-3">
        <div className="font-semibold text-sm">Articolele mele</div>
        {drafts.length === 0 && <p className="text-xs text-muted-foreground">Nu ai inca articole.</p>}
        {drafts.map((d) => {
          const payload = JSON.parse(d.payload_json || "{}");
          return (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">{payload.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{SUBMISSION_STATUS_LABELS[d.status] || d.status}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                {["draft", "needs_more_info"].includes(d.status) && (
                  <button onClick={() => submitArticle(d.id)} className="text-xs font-semibold underline underline-offset-4">Trimite spre review</button>
                )}
                {["draft", "pending_review", "needs_more_info"].includes(d.status) && (
                  <button onClick={() => withdrawArticle(d.id)} className="text-xs font-semibold text-destructive underline underline-offset-4">Retrage</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="font-semibold text-sm">Publicate</div>
        {published.length === 0 && <p className="text-xs text-muted-foreground">Niciun articol publicat.</p>}
        {published.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="font-semibold text-sm">{a.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{a.excerpt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}