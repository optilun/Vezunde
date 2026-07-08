import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { PROFESSIONAL_AFFILIATION_STATUS, PROFESSIONAL_TYPES } from "@/lib/vezunde";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none";

export default function ProviderTeam({ locationId }) {
  const [publicTeam, setPublicTeam] = useState([]);
  const [draft, setDraft] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ full_name: "", professional_type: "ophthalmologist", public_title: "", short_bio: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [publicRes, mineRes] = await Promise.all([
      base44.functions.invoke("getPublicProviderContent", { location_id: locationId }).catch(() => ({ data: { team: [] } })),
      base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } })),
    ]);
    setPublicTeam(publicRes.data?.team || []);
    const own = (mineRes.data?.submissions || []).find((s) => s.section === "team" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    setDraft(own || null);
    setMembers(own ? (JSON.parse(own.payload_json || "{}").members || []) : []);
  };

  useEffect(() => { load(); }, [locationId]);

  const addMember = () => {
    if (!form.full_name.trim()) return;
    setMembers([
      ...members,
      {
        ...form,
        assigned_location_ids: [locationId],
        visible_on_public_profile: true,
      },
    ]);
    setForm({ full_name: "", professional_type: "ophthalmologist", public_title: "", short_bio: "" });
  };

  const save = async () => {
    if (members.length === 0) { setMsg("Adauga cel putin un membru."); return; }
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: draft?.id, location_id: locationId, section: "team", payload: { members },
    }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat.");
    load();
  };

  const submit = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "team" }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Trimis spre review.");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Echipa</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Specialistii apar public prin aceasta locatie. Specialistii independenti nu sunt recomandati separat pacientilor in MVP.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-accent/40 p-4">
        <div className="font-semibold text-sm">Afiliere specialisti</div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Momentan poti adauga specialisti in echipa ca membri propusi de locatie. Confirmarea prin contul specialistului si invitatiile pe email sunt pregatite ca flux ulterior.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold text-sm mb-2">Echipa publica</div>
        {publicTeam.length === 0 && <p className="text-xs text-muted-foreground">Niciun membru public momentan.</p>}
        <ul className="space-y-2">
          {publicTeam.map((m) => (
            <li key={m.id} className="text-xs flex flex-wrap items-center justify-between gap-2">
              <span>{m.full_name} · {PROFESSIONAL_TYPES[m.professional_type] || m.professional_type}</span>
              <span className="text-muted-foreground">{m.public_title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">Draft echipa</div>
          {draft && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
        </div>
        <ul className="space-y-2">
          {members.map((m, i) => (
            <li key={i} className="rounded-lg border border-border/70 p-3 text-xs flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{m.full_name} · {PROFESSIONAL_TYPES[m.professional_type] || m.professional_type}</div>
                {m.public_title && <div className="text-muted-foreground mt-0.5">{m.public_title}</div>}
                <div className="mt-1 inline-flex text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {PROFESSIONAL_AFFILIATION_STATUS.location_added}
                </div>
              </div>
              {draft?.status !== "pending_review" && (
                <button onClick={() => setMembers(members.filter((_, idx) => idx !== i))} className="text-destructive shrink-0">Elimina</button>
              )}
            </li>
          ))}
        </ul>
        {draft?.status !== "pending_review" && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="text-xs font-semibold">Adauga specialist in echipa</div>
            <input className={inputCls} placeholder="Nume complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <select className={inputCls} value={form.professional_type} onChange={(e) => setForm({ ...form, professional_type: e.target.value })}>
              {Object.entries(PROFESSIONAL_TYPES).filter(([k]) => ["ophthalmologist", "optometrist", "optician"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className={inputCls} placeholder="Titlu public / rol in locatie" value={form.public_title} onChange={(e) => setForm({ ...form, public_title: e.target.value })} />
            <textarea className={inputCls} rows={2} placeholder="Descriere scurta" value={form.short_bio} onChange={(e) => setForm({ ...form, short_bio: e.target.value })} />
            <p className="text-[11px] text-muted-foreground">
              Afisarea completa/confirmata se va face dupa ce specialistul isi confirma afilierea prin contul lui.
            </p>
            <button onClick={addMember} className="px-4 py-2 rounded-full text-xs font-semibold border border-border">Adauga in draft</button>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button disabled={saving || draft?.status === "pending_review"} onClick={save} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border disabled:opacity-50">Salveaza draft</button>
          {draft && draft.status !== "pending_review" && (
            <button disabled={saving} onClick={submit} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>Trimite spre review</button>
          )}
        </div>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </div>
    </div>
  );
}