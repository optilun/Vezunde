import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  Check,
  ChevronRight,
  Copy,
  Mail,
  MapPin,
  Search,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ROLE_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-[15px] outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5";
const ALL_ROLES = ["organization_owner", "organization_admin", "location_manager", "location_staff"];
const ORGANIZATION_ROLES = new Set(["organization_owner", "organization_admin"]);
const ROLE_DESCRIPTIONS = {
  organization_owner: "Control complet, inclusiv administratori, setări sensibile și toate locațiile actuale și viitoare.",
  organization_admin: "Gestionează activitatea tuturor locațiilor actuale și viitoare, fără drepturile sensibile ale ownerului.",
  location_manager: "Gestionează conținutul și operațiunile locațiilor selectate.",
  location_staff: "Acces operațional limitat la locațiile selectate.",
};

function locationName(location) {
  return location?.public_display_name || location?.name || "Locație";
}

function initials(value = "") {
  return String(value || "U").split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "U";
}

function groupMembers(rows = []) {
  const groups = new Map();
  rows.forEach((membership) => {
    const key = membership.user_id || membership.membership_id;
    if (!key) return;
    const current = groups.get(key) || {
      user_id: membership.user_id,
      user_name: membership.user_name,
      user_email_masked: membership.user_email_masked,
      organization_id: membership.organization_id || null,
      memberships: [],
    };
    current.user_name = current.user_name || membership.user_name;
    current.user_email_masked = current.user_email_masked || membership.user_email_masked;
    current.organization_id = current.organization_id || membership.organization_id || null;
    current.memberships.push(membership);
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => String(a.user_name || a.user_email_masked).localeCompare(String(b.user_name || b.user_email_masked), "ro"));
}

function groupRole(group) {
  const activeRoles = group.memberships.filter((membership) => membership.status === "active").map((membership) => membership.role).filter(Boolean);
  for (const role of ALL_ROLES) if (activeRoles.includes(role)) return role;
  return "";
}

function groupRoleLabel(group) {
  const role = groupRole(group);
  return role ? (ROLE_LABELS[role] || role) : "Fără rol activ";
}

function accessSummary(group, allLocationIds, locationById) {
  const active = group.memberships.filter((membership) => membership.status === "active");
  const role = groupRole(group);
  if (ORGANIZATION_ROLES.has(role)) return { label: "Toate locațiile actuale și viitoare", locations: [] };
  const activeIds = [...new Set(active.map((membership) => membership.location_id).filter(Boolean))];
  if (activeIds.length === 0) return { label: "Fără acces activ", locations: [] };
  if (activeIds.length === allLocationIds.length && allLocationIds.length > 1) return { label: "Toate locațiile actuale", locations: [] };
  return {
    label: activeIds.length === 1 ? "O locație" : `${activeIds.length} locații`,
    locations: activeIds.map((id) => locationName(locationById[id])).filter(Boolean),
  };
}

function Drawer({ open, title, subtitle, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30 backdrop-blur-[2px]">
      <button type="button" aria-label="Închide" className="min-w-0 flex-1 cursor-default" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[520px] flex-col border-l border-border bg-background shadow-2xl" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-5">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-extrabold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary" aria-label="Închide"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

function RoleChoice({ role, selected, disabled, onSelect }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(role)}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "border-foreground/25 bg-secondary/45" : "border-border bg-card hover:bg-secondary/20"}`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>{selected && <Check className="h-3 w-3" />}</span>
      <span>
        <span className="block text-sm font-bold">{ROLE_LABELS[role] || role}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
      </span>
    </button>
  );
}

function LocationChoice({ location, selected, disabled, onToggle }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-65 ${selected ? "border-foreground/20 bg-secondary/35" : "border-border bg-card hover:bg-secondary/20"}`}
    >
      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-foreground bg-foreground text-background" : "border-border bg-background"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{locationName(location)}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{location.locality_name || location.city || "Localitate lipsă"}</span>
      </span>
    </button>
  );
}

export default function ProviderAccess({ organizationId = "", locations = [], onRefresh }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(null);
  const [editRole, setEditRole] = useState("location_staff");
  const [selectedLocationIds, setSelectedLocationIds] = useState([]);
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: "", role: "location_staff", location_ids: [] });
  const loadRequestRef = useRef(0);

  const locationById = useMemo(() => Object.fromEntries(locations.map((location) => [location.id, location])), [locations]);
  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    if (!organizationId) {
      setData({ members: [], invitations: [], manageable_location_ids: [], can_manage_members: false, counters: {} });
      setLoading(false);
      return;
    }
    const response = await base44.functions.invoke("getMyProviderMembers", { organization_id: organizationId })
      .catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    if (requestId !== loadRequestRef.current) return;
    setLoading(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      setData({ members: [], invitations: [], manageable_location_ids: [], can_manage_members: false, counters: {} });
      return;
    }
    setData(response.data || {});
  }, [organizationId]);

  useEffect(() => {
    setData(null);
    setMessage("");
    setInviteOpen(false);
    setMemberOpen(null);
    setQuery("");
    void load();
    return () => { loadRequestRef.current += 1; };
  }, [load]);

  const memberGroups = useMemo(() => groupMembers(data?.members || []), [data?.members]);
  const invitations = data?.invitations || [];
  const manageableLocationIds = data?.manageable_location_ids || [];
  const locationOptions = manageableLocationIds.map((id) => locationById[id]).filter(Boolean);
  const availableRoles = data?.available_invitation_roles?.length ? data.available_invitation_roles : [];
  const canManagePrivileged = data?.can_manage_privileged_roles === true;

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return memberGroups;
    return memberGroups.filter((group) => {
      const labels = group.memberships.map((membership) => locationName(locationById[membership.location_id])).join(" ");
      return [group.user_name, group.user_email_masked, groupRoleLabel(group), labels].join(" ").toLowerCase().includes(needle);
    });
  }, [memberGroups, query, locationById]);

  const filteredInvitations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invitations;
    return invitations.filter((invitation) => {
      const labels = (invitation.invited_location_ids || []).map((id) => locationName(locationById[id])).join(" ");
      return [invitation.invited_email_masked, ROLE_LABELS[invitation.proposed_role] || invitation.proposed_role, labels].join(" ").toLowerCase().includes(needle);
    });
  }, [invitations, query, locationById]);

  const resetInvite = () => {
    const initialRole = availableRoles.includes("location_staff") ? "location_staff" : (availableRoles[0] || "location_staff");
    setForm({ email: "", role: initialRole, location_ids: [] });
    setNewLink("");
    setCopied(false);
    setMessage("");
  };

  const openInvite = () => {
    resetInvite();
    setInviteOpen(true);
  };

  const changeInviteRole = (role) => {
    const organizationWide = ORGANIZATION_ROLES.has(role);
    setForm((current) => ({
      ...current,
      role,
      location_ids: organizationWide ? locationOptions.map((location) => location.id) : current.location_ids,
    }));
  };

  const toggleInviteLocation = (id) => {
    if (ORGANIZATION_ROLES.has(form.role)) return;
    setForm((current) => ({
      ...current,
      location_ids: current.location_ids.includes(id)
        ? current.location_ids.filter((locationId) => locationId !== id)
        : [...current.location_ids, id],
    }));
  };

  const createInvitation = async () => {
    setMessage("");
    setNewLink("");
    setCopied(false);
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage("Introdu un email valid."); return; }
    if (form.location_ids.length === 0) { setMessage("Selectează cel puțin o locație."); return; }
    setSaving(true);
    const response = await base44.functions.invoke("createProviderMemberInvitation", {
      organization_id: organizationId,
      invited_email: email,
      proposed_role: form.role,
      invited_location_ids: form.location_ids,
      invitation_base_url: window.location.origin,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setNewLink(response.data?.invitation_link || "");
    setMessage(response.data?.email_sent ? "Invitația a fost trimisă." : "Invitația a fost creată. Copiază linkul și trimite-l utilizatorului.");
    await load();
    await onRefresh?.();
  };

  const revokeInvitation = async (invitationId) => {
    if (!window.confirm("Revoci această invitație?")) return;
    setSaving(true);
    setMessage("");
    const response = await base44.functions.invoke("revokeProviderMemberInvitation", { invitation_id: invitationId })
      .catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    await load();
    await onRefresh?.();
  };

  const openMember = (group) => {
    const role = groupRole(group) || "location_staff";
    const activeLocationIds = [...new Set(group.memberships.filter((item) => item.status === "active").map((item) => item.location_id).filter(Boolean))];
    setEditRole(role);
    setSelectedLocationIds(ORGANIZATION_ROLES.has(role) ? locationOptions.map((location) => location.id) : activeLocationIds);
    setMemberOpen(group);
    setMessage("");
  };

  const editableRoles = canManagePrivileged ? ALL_ROLES : ["location_manager", "location_staff"];
  const memberCurrentRole = memberOpen ? groupRole(memberOpen) : "";
  const memberIsPrivileged = ORGANIZATION_ROLES.has(memberCurrentRole);
  const canEditOpenMember = canManagePrivileged || !memberIsPrivileged;

  const changeEditRole = (role) => {
    setEditRole(role);
    if (ORGANIZATION_ROLES.has(role)) setSelectedLocationIds(locationOptions.map((location) => location.id));
  };

  const toggleEditLocation = (id) => {
    if (ORGANIZATION_ROLES.has(editRole)) return;
    setSelectedLocationIds((current) => current.includes(id) ? current.filter((locationId) => locationId !== id) : [...current, id]);
  };

  const saveMemberAccess = async () => {
    if (!memberOpen?.user_id || !organizationId || !canEditOpenMember) return;
    if (selectedLocationIds.length === 0 && !window.confirm("Elimini accesul utilizatorului din toate locațiile?")) return;
    if (selectedLocationIds.length > 0 && !window.confirm("Salvezi rolul și accesul acestui utilizator?")) return;
    const assignments = selectedLocationIds.map((locationId) => ({ location_id: locationId, role: editRole }));
    setSaving(true);
    setMessage("");
    const response = await base44.functions.invoke("setProviderMemberAccess", {
      user_id: memberOpen.user_id,
      organization_id: organizationId,
      assignments,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setMessage("Accesul a fost actualizat.");
    await load();
    await onRefresh?.();
    setMemberOpen(null);
  };

  if (loading && !data) return <div className="rounded-[20px] border border-foreground/10 bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă utilizatorii și accesul...</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-foreground/10 bg-card p-5 shadow-[0_14px_40px_rgba(23,23,23,0.04)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#eaf0fc] text-[#345bc8]"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h1 className="font-heading text-[2rem] font-extrabold leading-tight tracking-[-0.035em]">Acces și utilizatori</h1>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">Ownerul și administratorul gestionează echipa. Numai ownerul poate acorda sau retrage roluri organizaționale.</p>
            </div>
          </div>
          {data?.can_manage_members && availableRoles.length > 0 && <button type="button" onClick={openInvite} className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90"><UserPlus className="h-4 w-4" /> Invită utilizator</button>}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[18px] bg-[#f8f4ec]/70 px-4 py-4"><div className="text-sm font-medium text-muted-foreground">Membri activi</div><div className="mt-1 text-2xl font-extrabold">{data?.counters?.active_members_total ?? memberGroups.length}</div></div>
          <div className="rounded-[18px] bg-[#f8f4ec]/70 px-4 py-4"><div className="text-sm font-medium text-muted-foreground">Administratori</div><div className="mt-1 text-2xl font-extrabold">{data?.counters?.organization_admins_count || 0}</div></div>
          <div className="rounded-[18px] bg-[#f8f4ec]/70 px-4 py-4"><div className="text-sm font-medium text-muted-foreground">Manageri de locație</div><div className="mt-1 text-2xl font-extrabold">{data?.counters?.location_managers_count || 0}</div></div>
          <div className="rounded-[18px] bg-[#f8f4ec]/70 px-4 py-4"><div className="text-sm font-medium text-muted-foreground">Invitații în așteptare</div><div className="mt-1 text-2xl font-extrabold">{invitations.length}</div></div>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputCls} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută după nume, email, rol sau locație..." />
          {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>}
        </div>
      </section>

      {message && !inviteOpen && !memberOpen && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{message}</div>}

      <section className="overflow-hidden rounded-[20px] border border-foreground/10 bg-card shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div><div className="flex items-center gap-2"><Users className="h-5 w-5" /><h2 className="text-lg font-bold">Membrii organizației</h2></div><p className="mt-1 text-sm text-muted-foreground">Rolul organizațional acoperă și locațiile viitoare; rolurile locale acoperă doar locațiile selectate.</p></div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{memberGroups.length} utilizatori</span>
        </div>
        {filteredMembers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nu există membri care corespund căutării.</div>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredMembers.map((group) => {
              const activeMemberships = group.memberships.filter((membership) => membership.status === "active");
              const access = accessSummary(group, locationOptions.map((location) => location.id), locationById);
              const privileged = ORGANIZATION_ROLES.has(groupRole(group));
              const editable = canManagePrivileged || !privileged;
              return (
                <div key={group.user_id} className="flex flex-col gap-4 px-5 py-4 transition hover:bg-secondary/10 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{initials(group.user_name || group.user_email_masked)}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{group.user_name || group.user_email_masked || "Utilizator"}</div>
                      {group.user_name && group.user_email_masked && <div className="mt-0.5 truncate text-xs text-muted-foreground">{group.user_email_masked}</div>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{groupRoleLabel(group)}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${activeMemberships.length ? "bg-green-50 text-green-800" : "bg-secondary text-muted-foreground"}`}>{activeMemberships.length ? "Activ" : "Inactiv"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 lg:max-w-[420px]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {access.label}</div>
                    {access.locations.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{access.locations.slice(0, 3).map((name) => <span key={name} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">{name}</span>)}{access.locations.length > 3 && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">+{access.locations.length - 3}</span>}</div>}
                  </div>
                  <button type="button" disabled={!editable} onClick={() => openMember(group)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">{editable ? "Gestionează accesul" : "Gestionat de owner"} <ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[20px] border border-foreground/10 bg-card shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div><div className="flex items-center gap-2"><Mail className="h-5 w-5" /><h2 className="text-lg font-bold">Invitații în așteptare</h2></div><p className="mt-1 text-sm text-muted-foreground">Invitațiile rămân aici până când sunt acceptate sau revocate.</p></div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{invitations.length} în așteptare</span>
        </div>
        {filteredInvitations.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">{query ? "Nu există invitații care corespund căutării." : "Nu există invitații în așteptare."}</div>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredInvitations.map((invitation) => {
              const organizationWide = ORGANIZATION_ROLES.has(invitation.proposed_role) || invitation.organization_wide_access;
              const invitedLocations = (invitation.invited_location_ids || []).map((id) => locationName(locationById[id])).filter(Boolean);
              const canRevoke = canManagePrivileged || !ORGANIZATION_ROLES.has(invitation.proposed_role);
              return (
                <div key={invitation.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{invitation.invited_email_masked}</div><div className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[invitation.proposed_role] || invitation.proposed_role}</div></div>
                  <div className="min-w-0 flex-1 lg:max-w-[420px]"><div className="text-sm font-semibold">{organizationWide ? "Toate locațiile actuale și viitoare" : `${invitedLocations.length} ${invitedLocations.length === 1 ? "locație" : "locații"}`}</div>{!organizationWide && invitedLocations.length > 0 && <div className="mt-1 truncate text-xs text-muted-foreground">{invitedLocations.join(" · ")}</div>}</div>
                  {invitation.expires_at && <div className="shrink-0 text-xs text-muted-foreground">Expiră la {new Date(invitation.expires_at).toLocaleDateString("ro-RO")}</div>}
                  <button type="button" disabled={saving || !canRevoke} onClick={() => revokeInvitation(invitation.id)} className="shrink-0 rounded-full border border-border px-3 py-2 text-sm font-semibold text-destructive hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">{canRevoke ? "Revocă" : "Doar ownerul"}</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Drawer open={inviteOpen} title="Invită utilizator" subtitle="Alege un rol clar și accesul corespunzător înainte de trimiterea invitației." onClose={() => setInviteOpen(false)}>
        <div className="space-y-5">
          <div><label className="text-xs font-semibold text-muted-foreground">Email utilizator</label><input className={`${inputCls} mt-1.5`} placeholder="nume@email.ro" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
          <div><div className="text-xs font-semibold text-muted-foreground">Rol</div><div className="mt-2 space-y-2">{availableRoles.map((role) => <RoleChoice key={role} role={role} selected={form.role === role} onSelect={changeInviteRole} />)}</div></div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-sm font-semibold">Acces la locații</div><p className="mt-1 text-xs text-muted-foreground">{ORGANIZATION_ROLES.has(form.role) ? "Accesul include automat locațiile actuale și viitoare." : "Selectează una sau mai multe locații."}</p></div>
              {!ORGANIZATION_ROLES.has(form.role) && locationOptions.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, location_ids: current.location_ids.length === locationOptions.length ? [] : locationOptions.map((location) => location.id) }))} className="text-xs font-semibold underline underline-offset-4">{form.location_ids.length === locationOptions.length ? "Șterge selecția" : "Selectează toate"}</button>}
            </div>
            <div className="mt-3 space-y-2">{locationOptions.map((location) => <LocationChoice key={location.id} location={location} selected={form.location_ids.includes(location.id)} disabled={ORGANIZATION_ROLES.has(form.role)} onToggle={() => toggleInviteLocation(location.id)} />)}</div>
          </div>
          {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">{message}</div>}
          {newLink && <div className="rounded-2xl border border-green-200 bg-green-50 p-3"><div className="text-sm font-bold text-green-900">Linkul este afișat o singură dată</div><p className="mt-1 break-all text-xs leading-relaxed text-green-900/80">{newLink}</p><button type="button" onClick={async () => { await navigator.clipboard.writeText(newLink); setCopied(true); }} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-900">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiat" : "Copiază linkul"}</button></div>}
          <button type="button" disabled={saving || Boolean(newLink)} onClick={createInvitation} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"><Send className="h-4 w-4" /> {saving ? "Se creează..." : "Trimite invitația"}</button>
        </div>
      </Drawer>

      <Drawer open={Boolean(memberOpen)} title={memberOpen?.user_name || memberOpen?.user_email_masked || "Acces utilizator"} subtitle="Stabilește un singur rol clar și locațiile accesibile." onClose={() => setMemberOpen(null)}>
        {memberOpen && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{initials(memberOpen.user_name || memberOpen.user_email_masked)}</div><div className="min-w-0"><div className="truncate text-sm font-bold">{memberOpen.user_name || "Utilizator"}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{memberOpen.user_email_masked}</div></div></div></div>
            {!canEditOpenMember && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">Rolurile de owner și administrator pot fi modificate numai de ownerul organizației.</div>}
            <div><div className="text-xs font-semibold text-muted-foreground">Rol</div><div className="mt-2 space-y-2">{editableRoles.map((role) => <RoleChoice key={role} role={role} selected={editRole === role} disabled={!canEditOpenMember || saving} onSelect={changeEditRole} />)}</div></div>
            <div>
              <div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Building2 className="h-4 w-4" /><h3 className="text-base font-bold">Acces pe locații</h3></div><p className="mt-1 text-sm text-muted-foreground">{ORGANIZATION_ROLES.has(editRole) ? "Rolul se aplică automat întregii organizații." : "Locațiile nebifate nu vor mai fi accesibile."}</p></div>{!ORGANIZATION_ROLES.has(editRole) && locationOptions.length > 1 && <button type="button" disabled={!canEditOpenMember} onClick={() => setSelectedLocationIds(selectedLocationIds.length === locationOptions.length ? [] : locationOptions.map((location) => location.id))} className="text-xs font-semibold underline underline-offset-4 disabled:opacity-50">{selectedLocationIds.length === locationOptions.length ? "Șterge selecția" : "Selectează toate"}</button>}</div>
              <div className="mt-3 space-y-2">{locationOptions.map((location) => <LocationChoice key={location.id} location={location} selected={selectedLocationIds.includes(location.id)} disabled={!canEditOpenMember || saving || ORGANIZATION_ROLES.has(editRole)} onToggle={() => toggleEditLocation(location.id)} />)}</div>
            </div>
            {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">{message}</div>}
            <div className="rounded-2xl border border-border bg-secondary/25 p-3 text-sm leading-relaxed text-muted-foreground">Ownerul are control complet. Administratorul gestionează toate locațiile, dar nu poate modifica owneri, administratori sau setările sensibile. Managerii și membrii primesc numai locațiile selectate.</div>
            <button type="button" disabled={saving || !canEditOpenMember} onClick={saveMemberAccess} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">{saving ? "Se salvează..." : "Salvează accesul"}</button>
          </div>
        )}
      </Drawer>
    </div>
  );
}
