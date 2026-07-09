import React, { useEffect, useState } from "react";
import { Mail, Send, Trash2, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";
import { PROFESSIONAL_AFFILIATION_STATUS, PROFESSIONAL_TYPES } from "@/lib/vezunde";

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
  pending_invite: "Invitatie pregatita",
  email_sent: "Invitatie trimisa",
  accepted: "Confirmat de specialist",
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
  const [form, setForm] = useState({ invite_email: "", full_name: "", professional_type: "ophthalmologist", public_title: "", short_bio: "" });
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
    if (!isValidEmail(email)) { setMsg("Introdu o adresa de email valida pentru specialist."); return; }
    if (members.some((m) => String(m.invite_email || "").toLowerCase() === email)) { setMsg("Acest email este deja adaugat in draft."); return; }
    setMembers([
      ...members,
      {
        ...form,
        invite_email: email,
        full_name: form.full_name.trim(),
        assigned_location_ids: [locationId],
        visible_on_public_profile: false,
        invite_status: "pending_invite",
        affiliation_status: "location_added",
        invitation_required: true,
      },
    ]);
    setForm({ invite_email: "", full_name: "", professional_type: "ophthalmologist", public_title: "", short_bio: "" });
    setMsg("Invitatia a fost adaugata in draft. Dupa trimitere, specialistul va primi email pentru confirmare.");
  };

  const save = async () => {
    if (members.length === 0) { setMsg("Adauga cel putin un specialist prin email."); return; }
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
    setMsg("Draft salvat. Trimite spre review/invitare cand este pregatit.");
    load();
  };

  const submit = async () => {
    if (!draft) return;
    setSaving(true); setMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: draft.id, location_id: locationId, section: "team" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    setSaving(false);
    if (res.data?.error) { setMsg(res.data.error); return; }
    setMsg("Invitatiile specialistilor au fost trimise spre procesare. Specialistii apar public doar dupa confirmare.");
    load();
  };

  const pendingReview = draft?.status === "pending_review";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Specialisti locatie</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Adauga doar specialistii care pot aparea public pe profilul locatiei: medici, optometristi, opticieni sau specialisti relevanti. Managerii si operatorii se gestioneaza separat in Acces si utilizatori.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/35 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card"><Mail className="h-4 w-4" /></div>
          <div>
            <div className="text-sm font-bold">Adaugare prin invitatie</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Introdu emailul specialistului. Daca are deja cont Vezunde, afilierea se leaga de contul existent. Daca nu are cont, primeste invitatie pe email sa isi creeze cont si sa confirme afilierea cu aceasta locatie.
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Specialisti publici confirmati</h2>
            <p className="mt-1 text-xs text-muted-foreground">Apar pe profil doar specialistii confirmati.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{publicTeam.length} publici</span>
        </div>
        {publicTeam.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-5 text-center text-xs text-muted-foreground">Niciun specialist public momentan.</p>
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

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Invitatii in lucru</h2>
            <p className="mt-1 text-xs text-muted-foreground">Specialistii invitati trebuie sa confirme afilierea inainte de afisarea publica.</p>
          </div>
          {draft && <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SUBMISSION_STATUS_LABELS[draft.status] || draft.status}</span>}
        </div>

        {members.length > 0 && (
          <ul className="space-y-2">
            {members.map((m, i) => (
              <li key={`${m.invite_email}-${i}`} className="rounded-2xl border border-border/70 p-3 text-xs flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold">{m.full_name || "Nume completat dupa acceptare"} · {roleLabel(m.professional_type)}</div>
                  <div className="mt-0.5 break-all text-muted-foreground">{m.invite_email}</div>
                  {m.public_title && <div className="mt-0.5 text-muted-foreground">{m.public_title}</div>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{INVITE_STATUS_LABELS[m.invite_status] || "Invitatie pregatita"}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{PROFESSIONAL_AFFILIATION_STATUS[m.affiliation_status] || PROFESSIONAL_AFFILIATION_STATUS.location_added}</span>
                  </div>
                </div>
                {!pendingReview && (
                  <button onClick={() => setMembers(members.filter((_, idx) => idx !== i))} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /> Elimina</button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!pendingReview && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="text-sm font-bold">Invita specialist</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Email specialist</label>
                <input className={`${inputCls} mt-1.5`} placeholder="nume@email.ro" value={form.invite_email} onChange={(e) => setForm({ ...form, invite_email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Rol profesional public</label>
                <select className={`${inputCls} mt-1.5`} value={form.professional_type} onChange={(e) => setForm({ ...form, professional_type: e.target.value })}>
                  {Object.entries(PUBLIC_SPECIALIST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Nume complet, optional</label>
                <input className={`${inputCls} mt-1.5`} placeholder="Se poate completa si de specialist" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Titlu public, optional</label>
                <input className={`${inputCls} mt-1.5`} placeholder="Ex: Medic primar oftalmolog" value={form.public_title} onChange={(e) => setForm({ ...form, public_title: e.target.value })} />
              </div>
            </div>
            <textarea className={inputCls} rows={2} placeholder="Nota scurta pentru profil, optional" value={form.short_bio} onChange={(e) => setForm({ ...form, short_bio: e.target.value })} />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Specialistul nu este publicat automat. Dupa invitatie, trebuie sa confirme afilierea. Verificarea Vezunde poate ramane necesara pentru rolurile medicale.
            </p>
            <button onClick={addInvite} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"><UserPlus className="h-4 w-4" /> Adauga invitatia in draft</button>
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
    </div>
  );
}
