import React, { useEffect, useState } from "react";
import { Send, Trash2, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { PROFESSIONAL_TYPES } from "@/lib/vezunde";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40";

const PUBLIC_SPECIALIST_TYPES = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician / specialist optica",
  contact_lens_specialist: "Specialist lentile de contact",
  optical_workshop_specialist: "Specialist atelier optic",
  other_specialist: "Alt specialist relevant",
};

const INVITE_STATUS_LABELS = {
  pending_invite: "In draft",
  email_sent: "Invitatie trimisa",
  accepted: "Confirmat",
};

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function roleLabel(key) {
  return PUBLIC_SPECIALIST_TYPES[key] || PROFESSIONAL_TYPES[key] || key;
}

export default function ProviderTeam({ locationId }) {
  const [publicTeam, setPublicTeam] = useState([]);
  const [draft, setDraft] = useState(null);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ invite_email: "", professional_type: "ophthalmologist" });
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
    const payload = own ? JSON.parse(own.payload_json || "{}") : {};
    setMembers(Array.isArray(payload.members) ? payload.members : []);
  };

  useEffect(() => { load(); }, [locationId]);

  const addInvite = () => {
    const email = form.invite_email.trim().toLowerCase();
    if (!isValidEmail(email)) { setMsg("Introdu un email valid."); return; }
    if (members.some((m) => String(m.invite_email || "").toLowerCase() === email)) { setMsg("Acest email este deja in draft."); return; }
    setMembers([
      ...members,
      {
        invite_email: email,
        professional_type: form.professional_type,
        full_name: "",
        public_title: "",
        short_bio: "",
        assigned_location_ids: [locationId],
        visible_on_public_profile: false,
        invite_status: "pending_invite",
        affiliation_status: "location_added",
        invitation_required: true,
      },
    ]);
    setForm({ invite_email: "", professional_type: "ophthalmologist" });
    setMsg("Invitatia a fost adaugata in draft.");
  };

  const save = async () => {
    if (members.length === 0) { setMsg("Adauga cel putin un specialist."); return; }
    setSaving(true); setMsg("");
    const action = draft && draft.status !== "pending_review" ? "update_draft" : "create_draft";
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action,
      submission_id: draft?.id,
      location_id: locationId,
      section: "team",
      payload: {
        invite_flow: true,
        invitation_channel: "email",
        members,
      },
    }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Draft salvat.");
    load();
  };

  const submit = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "team" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Invitatiile au fost trimise spre procesare. Specialistii apar public dupa confirmare.");
    load();
  };

  const pendingReview = draft?.status === "pending_review";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Specialisti locatie</h1>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Invita specialistii care pot aparea public pe profil. Managerii si operatorii se adauga separat in Acces si utilizatori.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Invita specialist</h2>
            <p className="mt-1 text-xs text-muted-foreground">Completezi emailul si functia. Restul detaliilor le completeaza specialistul dupa acceptare.</p>
          </div>
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
        </div>

        {!pendingReview && (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_auto] md:items-end">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Email specialist</label>
              <input className={`${inputCls} mt-1.5`} placeholder="nume@email.ro" value={form.invite_email} onChange={(e) => setForm({ ...form, invite_email: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Functie</label>
              <select className={`${inputCls} mt-1.5`} value={form.professional_type} onChange={(e) => setForm({ ...form, professional_type: e.target.value })}>
                {Object.entries(PUBLIC_SPECIALIST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <button onClick={addInvite} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90">
              <UserPlus className="h-4 w-4" /> Adauga
            </button>
          </div>
        )}

        {members.length > 0 && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="mb-2 text-sm font-bold">Invitatii pregatite</div>
            <ul className="space-y-2">
              {members.map((m, i) => (
                <li key={`${m.invite_email}-${i}`} className="rounded-2xl border border-border/70 px-3 py-2 text-xs flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold">{roleLabel(m.professional_type)}</div>
                    <div className="break-all text-muted-foreground">{m.invite_email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{INVITE_STATUS_LABELS[m.invite_status] || "In draft"}</span>
                    {!pendingReview && (
                      <button onClick={() => setMembers(members.filter((_, idx) => idx !== i))} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /> Sterge</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <button disabled={saving || pendingReview} onClick={save} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50">Salveaza draft</button>
          {draft && draft.status !== "pending_review" && (
            <button disabled={saving} onClick={submit} className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" /> Trimite invitatiile</button>
          )}
        </div>
        {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold">Specialisti confirmati</h2>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{publicTeam.length} publici</span>
        </div>
        {publicTeam.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-4 text-center text-xs text-muted-foreground">Niciun specialist confirmat momentan.</p>
        ) : (
          <ul className="space-y-2">
            {publicTeam.map((m) => (
              <li key={m.id} className="rounded-2xl border border-border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{m.full_name} · {roleLabel(m.professional_type)}</span>
                <span className="text-muted-foreground">{m.public_title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
