import React, { useEffect, useState } from "react";
import { Check, Copy, Trash2, UserPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40";

const PROFESSIONAL_TYPES = {
  ophthalmologist: "Medic oftalmolog",
  optometrist: "Optometrist",
  optician: "Optician",
};

const INVITE_STATUS_LABELS = {
  pending: "În așteptare",
  accepted: "Acceptată",
  expired: "Expirată",
  revoked: "Revocată",
};

function roleLabel(key) {
  return PROFESSIONAL_TYPES[key] || key;
}

function formatDate(value) {
  if (!value) return "";
  try { return new Date(value).toLocaleDateString("ro-RO"); } catch { return ""; }
}

export default function ProviderTeam({ locationId }) {
  const [publicTeam, setPublicTeam] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [form, setForm] = useState({ email: "", professional_type: "optometrist" });
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!locationId) return;
    const [publicRes, inviteRes] = await Promise.all([
      base44.functions.invoke("getPublicProviderContent", { location_id: locationId }).catch(() => ({ data: { team: [] } })),
      base44.functions.invoke("professionalInvitationOps", { action: "list", location_id: locationId }).catch((error) => ({ data: { invitations: [], error: error.response?.data?.error || error.message } })),
    ]);
    setPublicTeam(publicRes.data?.team || []);
    setInvitations(inviteRes.data?.invitations || []);
    if (inviteRes.data?.error) setMsg(inviteRes.data.error);
  };

  useEffect(() => {
    setNewLink("");
    setCopied(false);
    setMsg("");
    load();
  }, [locationId]);

  const createInvitation = async () => {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg("Introdu un email valid.");
      return;
    }

    setSaving(true);
    setMsg("");
    setNewLink("");
    setCopied(false);

    const response = await base44.functions.invoke("professionalInvitationOps", {
      action: "create",
      location_id: locationId,
      invited_email: email,
      professional_type: form.professional_type,
      invitation_base_url: window.location.origin,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));

    setSaving(false);
    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }

    setForm({ email: "", professional_type: "optometrist" });
    setNewLink(response.data?.invitation_link || "");
    setMsg(response.data?.email_sent ? "Invitația a fost trimisă." : "Invitația a fost creată. Trimite specialistului linkul afișat mai jos.");
    await load();
  };

  const revokeInvitation = async (invitationId) => {
    const confirmed = window.confirm("Revoci această invitație?");
    if (!confirmed) return;

    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("professionalInvitationOps", {
      action: "revoke",
      invitation_id: invitationId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);

    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Invitația a fost revocată.");
    await load();
  };

  const copyLink = async () => {
    if (!newLink) return;
    await navigator.clipboard.writeText(newLink);
    setCopied(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Specialiști locație</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
          Invită medicii oftalmologi, optometriștii și opticienii asociați acestei locații. Invitația nu le acordă acces administrativ și nu publică automat profilul.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Invită un specialist</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Specialistul acceptă cu propriul cont. Asocierea rămâne privată până când profilul profesional este completat și aprobat de Vezunde.
            </p>
          </div>
          <span className="rounded-full border border-border bg-secondary/45 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Separat de Acces și utilizatori</span>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)_auto] md:items-end">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Email specialist</label>
            <input className={`${inputCls} mt-1.5`} placeholder="nume@email.ro" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tip profesional</label>
            <select className={`${inputCls} mt-1.5`} value={form.professional_type} onChange={(event) => setForm({ ...form, professional_type: event.target.value })}>
              {Object.entries(PROFESSIONAL_TYPES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <button disabled={saving} onClick={createInvitation} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> Creează invitația
          </button>
        </div>

        {newLink && (
          <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3">
            <div className="text-xs font-bold text-green-900">Linkul este afișat o singură dată</div>
            <p className="mt-1 break-all text-xs leading-relaxed text-green-900/80">{newLink}</p>
            <button type="button" onClick={copyLink} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-900">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiat" : "Copiază linkul"}
            </button>
          </div>
        )}

        {msg && <p className="mt-3 text-xs text-muted-foreground">{msg}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Invitații profesionale</h2>
            <p className="mt-1 text-xs text-muted-foreground">Invitațiile expiră automat și pot fi revocate înainte de acceptare.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{invitations.length} total</span>
        </div>

        {invitations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-4 text-center text-xs text-muted-foreground">Nu există invitații pentru această locație.</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2.5 text-xs">
                <div className="min-w-0">
                  <div className="font-bold">{roleLabel(invitation.professional_type)}</div>
                  <div className="break-all text-muted-foreground">{invitation.invited_email_masked}</div>
                  {invitation.expires_at && invitation.status === "pending" && <div className="mt-0.5 text-[11px] text-muted-foreground">Expiră la {formatDate(invitation.expires_at)}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{INVITE_STATUS_LABELS[invitation.status] || invitation.status}</span>
                  {invitation.status === "pending" && (
                    <button disabled={saving} onClick={() => revokeInvitation(invitation.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" /> Revocă
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Specialiști publicați</h2>
            <p className="mt-1 text-xs text-muted-foreground">Aici apar doar profilurile aprobate și asociate public acestei locații.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{publicTeam.length} publici</span>
        </div>
        {publicTeam.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-4 text-center text-xs text-muted-foreground">Niciun specialist publicat momentan.</p>
        ) : (
          <ul className="space-y-2">
            {publicTeam.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border px-3 py-2 text-xs">
                <span className="font-semibold">{member.full_name} · {roleLabel(member.professional_type)}</span>
                <span className="text-muted-foreground">{member.public_title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}