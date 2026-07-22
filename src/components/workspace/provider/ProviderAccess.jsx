import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Copy, Mail, MapPin, Search, Send, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ROLE_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-[15px] outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5";
const ALL_ROLES = ["organization_owner", "organization_admin", "location_manager", "location_staff"];
const PRIVILEGED_ROLES = new Set(["organization_owner", "organization_admin"]);
const ROLE_DESCRIPTIONS = {
  organization_owner: "Poate avea acces la toate locațiile sau numai la locațiile selectate. Controlează utilizatorii din propriul scope.",
  organization_admin: "Gestionează activitatea tuturor locațiilor actuale și viitoare, fără drepturile sensibile ale ownerului.",
  location_manager: "Gestionează conținutul și operațiunile locațiilor selectate.",
  location_staff: "Acces operațional limitat la locațiile selectate.",
};

function locationName(location) { return location?.public_display_name || location?.name || "Locație"; }
function initials(value = "") { return String(value || "U").split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "U"; }
function groupMembers(rows = []) {
  const groups = new Map();
  rows.forEach((membership) => {
    const key = membership.user_id || membership.membership_id;
    if (!key) return;
    const current = groups.get(key) || { user_id: membership.user_id, user_name: membership.user_name, user_email_masked: membership.user_email_masked, memberships: [] };
    current.user_name = current.user_name || membership.user_name;
    current.user_email_masked = current.user_email_masked || membership.user_email_masked;
    current.memberships.push(membership);
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => String(a.user_name || a.user_email_masked).localeCompare(String(b.user_name || b.user_email_masked), "ro"));
}
function groupRole(group) {
  const roles = group.memberships.filter((row) => row.status === "active").map((row) => row.role);
  return ALL_ROLES.find((role) => roles.includes(role)) || "";
}
function groupWide(group) { return group.memberships.some((row) => row.status === "active" && row.organization_wide_access === true); }
function activeLocationIds(group) { return [...new Set(group.memberships.filter((row) => row.status === "active").map((row) => row.location_id).filter(Boolean))]; }

function Drawer({ open, title, subtitle, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30 backdrop-blur-[2px]">
      <button type="button" aria-label="Închide" className="min-w-0 flex-1 cursor-default" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[520px] flex-col border-l border-border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-5">
          <div><h2 className="font-heading text-xl font-extrabold tracking-tight">{title}</h2>{subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}</div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-border" aria-label="Închide"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

function RoleChoice({ role, selected, disabled = false, onSelect }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onSelect(role)} className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-foreground/25 bg-secondary/45" : "border-border bg-card hover:bg-secondary/20"}`}>
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>{selected && <Check className="h-3 w-3" />}</span>
      <span><span className="block text-sm font-bold">{ROLE_LABELS[role] || role}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span></span>
    </button>
  );
}

function ScopeChoice({ value, disabledAll, onChange }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={disabledAll} onClick={() => onChange("all")} className={`rounded-2xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${value === "all" ? "border-foreground/25 bg-secondary/45" : "border-border"}`}><span className="block text-sm font-bold">Toată organizația</span><span className="mt-1 block text-xs text-muted-foreground">Locațiile actuale și viitoare</span></button>
      <button type="button" onClick={() => onChange("selected")} className={`rounded-2xl border p-3 text-left ${value === "selected" ? "border-foreground/25 bg-secondary/45" : "border-border"}`}><span className="block text-sm font-bold">Locații selectate</span><span className="mt-1 block text-xs text-muted-foreground">Numai locațiile bifate</span></button>
    </div>
  );
}

function LocationChoice({ location, selected, disabled, onToggle }) {
  return (
    <button type="button" disabled={disabled} onClick={onToggle} className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-foreground/20 bg-secondary/35" : "border-border"}`}>
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
      <span className="min-w-0"><span className="block truncate text-sm font-bold">{locationName(location)}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{location.locality_name || location.city || "Localitate lipsă"}</span></span>
    </button>
  );
}

function UserAccessSummary({ group, allIds, locationById }) {
  const wide = groupWide(group);
  const ids = activeLocationIds(group);
  if (wide) return <span>Toate locațiile actuale și viitoare</span>;
  if (ids.length === allIds.length && allIds.length > 1) return <span>Toate locațiile actuale</span>;
  if (!ids.length) return <span>Fără acces activ</span>;
  return <span>{ids.map((id) => locationName(locationById[id])).filter(Boolean).join(" · ")}</span>;
}

export default function ProviderAccess({ organizationId = "", locations = [], onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(null);
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: "", role: "location_staff", scope: "selected", location_ids: [] });
  const [edit, setEdit] = useState({ role: "location_staff", scope: "selected", location_ids: [] });
  const loadRequestRef = useRef(0);
  const locationById = useMemo(() => Object.fromEntries(locations.map((location) => [location.id, location])), [locations]);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    const response = await base44.functions.invoke("getMyProviderMembers", { organization_id: organizationId }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    if (requestId !== loadRequestRef.current) return;
    setLoading(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      setData((prev) => prev || { members: [], invitations: [], manageable_location_ids: [], counters: {} });
      return;
    }
    setData(response.data || {});
    setMessage("");
  }, [organizationId]);

  useEffect(() => {
    setMessage(""); setInviteOpen(false); setMemberOpen(null); setQuery(""); void load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const groups = useMemo(() => groupMembers(data?.members || []), [data?.members]);
  const invitations = data?.invitations || [];
  const locationOptions = (data?.manageable_location_ids || []).map((id) => locationById[id]).filter(Boolean);
  const allLocationIds = locationOptions.map((location) => location.id);
  const availableRoles = data?.available_invitation_roles || [];
  const canManageOwners = data?.can_manage_privileged_roles === true;
  const canGrantAdmin = data?.can_grant_organization_admin === true;
  const filteredGroups = groups.filter((group) => !query || [group.user_name, group.user_email_masked, ROLE_LABELS[groupRole(group)], ...activeLocationIds(group).map((id) => locationName(locationById[id]))].join(" ").toLowerCase().includes(query.toLowerCase()));
  const filteredInvitations = invitations.filter((invitation) => !query || [invitation.invited_email_masked, ROLE_LABELS[invitation.proposed_role]].join(" ").toLowerCase().includes(query.toLowerCase()));

  const applyRoleToForm = (role) => {
    const scope = role === "organization_admin" ? "all" : (role === "organization_owner" ? (canGrantAdmin ? "all" : "selected") : "selected");
    setForm((current) => ({ ...current, role, scope, location_ids: scope === "all" ? allLocationIds : [] }));
  };
  const setFormScope = (scope) => setForm((current) => ({ ...current, scope, location_ids: scope === "all" ? allLocationIds : [] }));
  const toggleFormLocation = (id) => setForm((current) => ({ ...current, location_ids: current.location_ids.includes(id) ? current.location_ids.filter((item) => item !== id) : [...current.location_ids, id] }));
  const openInvite = () => {
    const role = availableRoles.includes("location_staff") ? "location_staff" : availableRoles[0];
    setForm({ email: "", role, scope: role === "organization_admin" ? "all" : "selected", location_ids: role === "organization_admin" ? allLocationIds : [] });
    setMessage(""); setNewLink(""); setCopied(false); setInviteOpen(true);
  };

  const createInvitation = async () => {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage("Introdu un email valid."); return; }
    if (!form.location_ids.length) { setMessage("Selectează cel puțin o locație."); return; }
    setSaving(true); setMessage("");
    const response = await base44.functions.invoke("createProviderMemberInvitation", {
      organization_id: organizationId,
      invited_email: email,
      proposed_role: form.role,
      invited_location_ids: form.location_ids,
      organization_wide_access: form.scope === "all",
      invitation_base_url: window.location.origin,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setNewLink(response.data?.invitation_link || "");
    setMessage(response.data?.email_sent ? "Invitația a fost trimisă." : "Invitația a fost creată. Copiază linkul și trimite-l utilizatorului.");
    await load(); await onRefresh?.();
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoci această invitație?")) return;
    setSaving(true);
    const response = await base44.functions.invoke("revokeProviderMemberInvitation", { invitation_id: id }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    await load(); await onRefresh?.();
  };

  const openMember = (group) => {
    const role = groupRole(group) || "location_staff";
    const scope = groupWide(group) ? "all" : "selected";
    setEdit({ role, scope, location_ids: scope === "all" ? allLocationIds : activeLocationIds(group) });
    setMessage(""); setMemberOpen(group);
  };
  const applyEditRole = (role) => {
    const scope = role === "organization_admin" ? "all" : (role === "organization_owner" ? edit.scope : "selected");
    setEdit((current) => ({ ...current, role, scope, location_ids: scope === "all" ? allLocationIds : (current.scope === "all" ? [] : current.location_ids) }));
  };
  const setEditScope = (scope) => setEdit((current) => ({ ...current, scope, location_ids: scope === "all" ? allLocationIds : [] }));
  const toggleEditLocation = (id) => setEdit((current) => ({ ...current, location_ids: current.location_ids.includes(id) ? current.location_ids.filter((item) => item !== id) : [...current.location_ids, id] }));
  const saveMember = async () => {
    if (!edit.location_ids.length && !window.confirm("Elimini accesul utilizatorului din toate locațiile?")) return;
    setSaving(true); setMessage("");
    const response = await base44.functions.invoke("setProviderMemberAccess", {
      user_id: memberOpen.user_id,
      organization_id: organizationId,
      organization_wide_access: edit.scope === "all",
      assignments: edit.location_ids.map((location_id) => ({ location_id, role: edit.role })),
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setMemberOpen(null); await load(); await onRefresh?.();
  };

  const currentMemberRole = memberOpen ? groupRole(memberOpen) : "";
  const currentMemberWide = memberOpen ? groupWide(memberOpen) : false;
  const canEditMember = !PRIVILEGED_ROLES.has(currentMemberRole)
    || canGrantAdmin
    || (currentMemberRole === "organization_owner" && !currentMemberWide && canManageOwners);
  const editRoles = availableRoles.length ? availableRoles : [];

  if (loading && !data) return <div className="rounded-[20px] border border-foreground/10 bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă utilizatorii și accesul...</div>;

  const accessError = Boolean(message && !data?.members?.length && !data?.invitations?.length);

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-foreground/10 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#eaf0fc] text-[#345bc8]"><ShieldCheck className="h-5 w-5" /></div><div><h1 className="font-heading text-[2rem] font-extrabold tracking-tight">Acces și utilizatori</h1><p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">Ownerul poate fi global sau selectiv. Administratorul acoperă toate locațiile. Managerul și membrul acoperă locațiile bifate.</p></div></div>{data?.can_manage_members && availableRoles.length > 0 && <button type="button" onClick={openInvite} className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"><UserPlus className="h-4 w-4" /> Invită utilizator</button>}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Membri activi", data?.counters?.active_members_total || 0], ["Owneri globali", data?.counters?.global_owners_count || 0], ["Administratori", data?.counters?.organization_admins_count || 0], ["Invitații", invitations.length]].map(([label, value]) => <div key={label} className="rounded-[18px] bg-[#f8f4ec]/70 px-4 py-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-extrabold">{value}</div></div>)}</div>
        <div className="relative mt-4"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={`${inputCls} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută după nume, email, rol sau locație..." /></div>
      </section>
      {accessError && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>Unele date de acces nu au putut fi încărcate. Utilizatorii existenți nu au fost șterși.</span>
          <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center justify-center rounded-full border border-amber-300 bg-background px-4 text-xs font-semibold hover:bg-amber-100">Reîncearcă</button>
        </div>
      )}
      {message && !accessError && !inviteOpen && !memberOpen && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

      <section className="overflow-hidden rounded-[20px] border border-foreground/10 bg-card shadow-sm">
        <div className="flex justify-between border-b border-border px-5 py-4"><div><div className="flex items-center gap-2"><Users className="h-5 w-5" /><h2 className="text-lg font-bold">Membrii organizației</h2></div><p className="mt-1 text-sm text-muted-foreground">Rol și scope clar pentru fiecare utilizator.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{groups.length}</span></div>
        <div className="divide-y divide-border/70">{filteredGroups.length ? filteredGroups.map((group) => {
          const role = groupRole(group);
          const wide = groupWide(group);
          const editable = !PRIVILEGED_ROLES.has(role) || canGrantAdmin || (role === "organization_owner" && !wide && canManageOwners);
          return <div key={group.user_id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{initials(group.user_name || group.user_email_masked)}</div><div className="min-w-0"><div className="truncate text-sm font-bold">{group.user_name || group.user_email_masked}</div><div className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[role] || "Fără rol"}{role === "organization_owner" ? (wide ? " · global" : " · selectiv") : ""}</div></div></div><div className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" /><UserAccessSummary group={group} allIds={allLocationIds} locationById={locationById} /></div><button type="button" disabled={!editable} onClick={() => openMember(group)} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-45">{editable ? "Gestionează accesul" : "Gestionat de ownerul global"}<ChevronRight className="h-3.5 w-3.5" /></button></div>;
        }) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nu există utilizatori care corespund căutării.</div>}</div>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-foreground/10 bg-card shadow-sm"><div className="flex justify-between border-b border-border px-5 py-4"><div><div className="flex items-center gap-2"><Mail className="h-5 w-5" /><h2 className="text-lg font-bold">Invitații în așteptare</h2></div></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{invitations.length}</span></div><div className="divide-y divide-border/70">{filteredInvitations.length ? filteredInvitations.map((invitation) => { const privileged = PRIVILEGED_ROLES.has(invitation.proposed_role); const canRevoke = !privileged || canGrantAdmin || (invitation.proposed_role === "organization_owner" && !invitation.organization_wide_access && canManageOwners); return <div key={invitation.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{invitation.invited_email_masked}</div><div className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[invitation.proposed_role]}{invitation.proposed_role === "organization_owner" ? (invitation.organization_wide_access ? " · global" : " · selectiv") : ""}</div></div><div className="flex-1 text-sm font-semibold">{invitation.organization_wide_access ? "Toate locațiile actuale și viitoare" : `${invitation.invited_location_ids?.length || 0} locații selectate`}</div><button type="button" disabled={!canRevoke || saving} onClick={() => revoke(invitation.id)} className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-destructive disabled:opacity-45">{canRevoke ? "Revocă" : "Doar ownerul global"}</button></div>; }) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nu există invitații în așteptare.</div>}</div></section>

      <Drawer open={inviteOpen} title="Invită utilizator" subtitle="Alege rolul și scope-ul înainte de trimitere." onClose={() => setInviteOpen(false)}>
        <div className="space-y-5"><div><label className="text-xs font-semibold text-muted-foreground">Email</label><input className={`${inputCls} mt-1.5`} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="nume@email.ro" /></div><div><div className="text-xs font-semibold text-muted-foreground">Rol</div><div className="mt-2 space-y-2">{availableRoles.map((role) => <RoleChoice key={role} role={role} selected={form.role === role} onSelect={applyRoleToForm} />)}</div></div>{form.role === "organization_owner" && <div><div className="mb-2 text-xs font-semibold text-muted-foreground">Scope owner</div><ScopeChoice value={form.scope} disabledAll={!canGrantAdmin} onChange={setFormScope} /></div>}{form.role === "organization_admin" && <div className="rounded-2xl bg-secondary/35 p-3 text-sm text-muted-foreground">Administratorul primește automat toate locațiile actuale și viitoare.</div>}<div><div className="flex justify-between"><div className="text-sm font-semibold">Locații</div>{form.scope === "selected" && locationOptions.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, location_ids: current.location_ids.length === allLocationIds.length ? [] : allLocationIds }))} className="text-xs font-semibold underline">{form.location_ids.length === allLocationIds.length ? "Șterge selecția" : "Selectează toate"}</button>}</div><div className="mt-3 space-y-2">{locationOptions.map((location) => <LocationChoice key={location.id} location={location} selected={form.location_ids.includes(location.id)} disabled={form.scope === "all"} onToggle={() => toggleFormLocation(location.id)} />)}</div></div>{message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}{newLink && <div className="rounded-2xl border border-green-200 bg-green-50 p-3"><p className="break-all text-xs">{newLink}</p><button type="button" onClick={async () => { await navigator.clipboard.writeText(newLink); setCopied(true); }} className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copiat" : "Copiază linkul"}</button></div>}<button type="button" disabled={saving || Boolean(newLink)} onClick={createInvitation} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" />{saving ? "Se creează..." : "Trimite invitația"}</button></div>
      </Drawer>

      <Drawer open={Boolean(memberOpen)} title={memberOpen?.user_name || memberOpen?.user_email_masked || "Acces utilizator"} subtitle="Modifică rolul și scope-ul utilizatorului." onClose={() => setMemberOpen(null)}>
        {memberOpen && <div className="space-y-5">{!canEditMember && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Acest rol poate fi modificat numai de un owner global.</div>}<div><div className="text-xs font-semibold text-muted-foreground">Rol</div><div className="mt-2 space-y-2">{editRoles.map((role) => <RoleChoice key={role} role={role} selected={edit.role === role} disabled={!canEditMember || saving} onSelect={applyEditRole} />)}</div></div>{edit.role === "organization_owner" && <div><div className="mb-2 text-xs font-semibold text-muted-foreground">Scope owner</div><ScopeChoice value={edit.scope} disabledAll={!canGrantAdmin} onChange={setEditScope} /></div>}{edit.role === "organization_admin" && <div className="rounded-2xl bg-secondary/35 p-3 text-sm text-muted-foreground">Administratorul trebuie să rămână pe toate locațiile actuale și viitoare.</div>}<div><div className="flex justify-between"><div className="text-sm font-semibold">Locații</div>{edit.scope === "selected" && <button type="button" onClick={() => setEdit((current) => ({ ...current, location_ids: current.location_ids.length === allLocationIds.length ? [] : allLocationIds }))} className="text-xs font-semibold underline">{edit.location_ids.length === allLocationIds.length ? "Șterge selecția" : "Selectează toate"}</button>}</div><div className="mt-3 space-y-2">{locationOptions.map((location) => <LocationChoice key={location.id} location={location} selected={edit.location_ids.includes(location.id)} disabled={!canEditMember || saving || edit.scope === "all"} onToggle={() => toggleEditLocation(location.id)} />)}</div></div>{message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}<button type="button" disabled={saving || !canEditMember} onClick={saveMember} className="h-11 w-full rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-50">{saving ? "Se salvează..." : "Salvează accesul"}</button></div>}
      </Drawer>
    </div>
  );
}