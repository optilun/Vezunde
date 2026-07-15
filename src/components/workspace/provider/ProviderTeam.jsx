import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Trash2, UserPlus, Send, Eye, EyeOff } from "lucide-react";
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

function assignmentStatus(item) {
  if (item.active_status === "inactiv") return { label: "Eliminat", className: "bg-red-50 text-red-700" };
  if (item.public_status === "public" && item.is_public && item.verification_status === "verified") return { label: "Public", className: "bg-green-100 text-green-800" };
  if (item.profile_review_status === "pending_review") return { label: "În verificare", className: "bg-amber-50 text-amber-800" };
  if (item.profile_review_status === "needs_more_info") return { label: "Necesită completări", className: "bg-amber-50 text-amber-800" };
  return { label: "Privat", className: "bg-secondary text-muted-foreground" };
}

function EmptyCard({ children }) {
  return <p className="rounded-2xl border border-dashed border-border bg-secondary/30 px-4 py-5 text-center text-xs text-muted-foreground">{children}</p>;
}

export default function ProviderTeam({ locationId }) {
  const [publicTeam, setPublicTeam] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [form, setForm] = useState({ email: "", professional_type: "optometrist" });
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const activeAssignments = useMemo(() => assignments.filter((item) => item.active_status === "activ"), [assignments]);
  const pendingInvitations = useMemo(() => invitations.filter((item) => item.status === "pending"), [invitations]);

  const load = async () => {
    if (!locationId) return;
    const [publicRes, inviteRes, assignmentRes] = await Promise.all([
      base44.functions.invoke("getPublicProviderContent", { location_id: locationId }).catch(() => ({ data: { team: [] } })),
      base44.functions.invoke("professionalInvitationOps", { action: "list", location_id: locationId }).catch((error) => ({ data: { invitations: [], error: error.response?.data?.error || error.message } })),
      base44.functions.invoke("manageProfessionalAssignment", { action: "list", location_id: locationId }).catch((error) => ({ data: { assignments: [], error: error.response?.data?.error || error.message } })),
    ]);
    setPublicTeam(publicRes.data?.team || []);
    setInvitations(inviteRes.data?.invitations || []);
    setAssignments(assignmentRes.data?.assignments || []);
    if (inviteRes.data?.error) setMsg(inviteRes.data.error);
    else if (assignmentRes.data?.error) setMsg(assignmentRes.data.error);
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

  const deactivateAssignment = async (professionalId) => {
    const confirmed = window.confirm("Elimini acest specialist din locație? Profilul profesional nu va fi șters.");
    if (!confirmed) return;

    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: "deactivate",
      location_id: locationId,
      professional_id: professionalId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);

    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg("Asocierea specialistului cu această locație a fost eliminată.");
    await load();
  };

  const setAssignmentVisibility = async (assignment, publicStatus) => {
    const actionLabel = publicStatus === "public" ? "publici" : "ascunzi";
    const confirmed = window.confirm(`Sigur vrei sa ${actionLabel} acest specialist pe profilul public al locatiei?`);
    if (!confirmed) return;

    setSaving(true);
    setMsg("");
    const response = await base44.functions.invoke("manageProfessionalAssignment", {
      action: "set_visibility",
      location_id: locationId,
      professional_id: assignment.professional_id,
      public_status: publicStatus,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);

    if (response.data?.error) {
      setMsg(response.data.error);
      return;
    }
    setMsg(publicStatus === "public"
      ? "Specialistul este acum vizibil pe profilul public al locatiei."
      : "Specialistul a fost ascuns de pe profilul public al locatiei.");
    await load();
  };

  const copyLink = async () => {
    if (!newLink) return;
    await navigator.clipboard.writeText(newLink);
    setCopied(true);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
      <div className="order-2 space-y-4 xl:order-1">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Specialiști asociați</h2>
              <p className="mt-1 text-xs text-muted-foreground">Poți elimina asocierea cu locația, dar nu poți modifica identitatea profesională a specialistului.</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{activeAssignments.length} activi · {publicTeam.length} publici</span>
          </div>

          {assignments.length === 0 ? <EmptyCard>Nu există specialiști asociați acestei locații.</EmptyCard> : (
            <ul className="space-y-2">
              {assignments.map((assignment) => {
                const status = assignmentStatus(assignment);
                return (
                  <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-3 py-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold">{assignment.full_name}</div>
                      <div className="mt-0.5 text-muted-foreground">{roleLabel(assignment.professional_type)}</div>
                      {assignment.active_status === "activ" && assignment.public_status !== "public" && !assignment.can_publish && assignment.publish_block_reason && (
                        <div className="mt-1 max-w-xl text-[11px] leading-relaxed text-amber-700">{assignment.publish_block_reason}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                      {assignment.active_status === "activ" && (
                        <>
                          <button
                            type="button"
                            disabled={saving || (assignment.public_status !== "public" && !assignment.can_publish)}
                            title={assignment.public_status !== "public" && !assignment.can_publish ? assignment.publish_block_reason : ""}
                            onClick={() => setAssignmentVisibility(assignment, assignment.public_status === "public" ? "privat" : "public")}
                            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {assignment.public_status === "public" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {assignment.public_status === "public" ? "Ascunde" : "Publica"}
                          </button>
                          <button type="button" disabled={saving} onClick={() => deactivateAssignment(assignment.professional_id)} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                            <Trash2 className="h-3.5 w-3.5" /> Elimină
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Invitații profesionale</h2>
              <p className="mt-1 text-xs text-muted-foreground">Invitațiile expiră automat și pot fi revocate înainte de acceptare.</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{invitations.length} total</span>
          </div>

          {invitations.length === 0 ? <EmptyCard>Nu există invitații pentru această locație.</EmptyCard> : (
            <ul className="space-y-2">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold">{roleLabel(invitation.professional_type)}</div>
                    <div className="break-all text-muted-foreground">{invitation.invited_email_masked}</div>
                    {invitation.expires_at && invitation.status === "pending" && <div className="mt-0.5 text-[11px] text-muted-foreground">Expiră la {formatDate(invitation.expires_at)}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{INVITE_STATUS_LABELS[invitation.status] || invitation.status}</span>
                    {invitation.status === "pending" && (
                      <button type="button" disabled={saving} onClick={() => revokeInvitation(invitation.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-secondary disabled:opacity-50">
                        <Trash2 className="h-3.5 w-3.5" /> Revocă
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="order-1 space-y-4 xl:sticky xl:top-4 xl:order-2">
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <h2 className="text-sm font-bold">Rezumat specialiști</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-secondary/45 p-3">
              <div className="text-[10px] font-semibold leading-tight text-muted-foreground">Asociați activ</div>
              <div className="mt-1 text-xl font-extrabold">{activeAssignments.length}</div>
            </div>
            <div className="rounded-xl bg-secondary/45 p-3">
              <div className="text-[10px] font-semibold leading-tight text-muted-foreground">Vizibili public</div>
              <div className="mt-1 text-xl font-extrabold">{publicTeam.length}</div>
            </div>
            <div className="rounded-xl bg-secondary/45 p-3">
              <div className="text-[10px] font-semibold leading-tight text-muted-foreground">În așteptare</div>
              <div className="mt-1 text-xl font-extrabold">{pendingInvitations.length}</div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Invită un specialist</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Invită medicii oftalmologi, optometriștii și opticienii asociați acestei locații. Specialistul acceptă cu propriul cont. Asocierea rămâne privată până când profilul profesional este completat și aprobat de VIASEE.</p>
            </div>
          </div>

          <div className="space-y-3">
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
          </div>

          <button type="button" disabled={saving} onClick={createInvitation} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50">
            <Send className="h-4 w-4" /> Creează invitația
          </button>

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

          <div className="mt-4 rounded-2xl border border-border bg-secondary/25 p-3">
            <div className="text-[11px] font-bold text-foreground">Separat de Acces și utilizatori</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Invitația nu le acordă acces administrativ și nu publică automat profilul. Profilul specialistului devine public doar după completare și aprobarea VIASEE. Asocierea cu locația nu acordă acces administrativ.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
