import React, { useEffect, useMemo, useState } from "react";
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

const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5";
const ROLE_ORDER = ["organization_owner", "location_manager", "location_staff"];

function locationName(location) {
  return location?.public_display_name || location?.name || "Locatie";
}

function initials(value = "") {
  return String(value || "U")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

function roleRank(role) {
  const index = ROLE_ORDER.indexOf(role);
  return index === -1 ? ROLE_ORDER.length : index;
}

function highestRole(memberships = []) {
  return [...memberships].sort((a, b) => roleRank(a.role) - roleRank(b.role))[0]?.role || "location_staff";
}

function groupMembers(rows = []) {
  const groups = new Map();
  rows.forEach((membership) => {
    const key = membership.user_id || membership.membership_id;
    const current = groups.get(key) || {
      user_id: membership.user_id,
      user_name: membership.user_name,
      user_email_masked: membership.user_email_masked,
      memberships: [],
    };
    current.user_name = current.user_name || membership.user_name;
    current.user_email_masked = current.user_email_masked || membership.user_email_masked;
    current.memberships.push(membership);
    groups.set(key, current);
  });
  return [...groups.values()].sort((a, b) => String(a.user_name || a.user_email_masked).localeCompare(String(b.user_name || b.user_email_masked), "ro"));
}

function accessSummary(group, allLocationIds, locById) {
  const active = group.memberships.filter((membership) => membership.status === "active");
  const activeIds = [...new Set(active.map((membership) => membership.location_id))];
  const ownerEverywhere = allLocationIds.length > 0
    && allLocationIds.every((id) => active.some((membership) => membership.location_id === id && membership.role === "organization_owner"));
  if (ownerEverywhere) return { label: "Intreaga organizatie", locations: [] };
  if (activeIds.length === 0) return { label: "Fara acces activ", locations: [] };
  if (activeIds.length === allLocationIds.length && allLocationIds.length > 1) return { label: "Toate locatiile actuale", locations: [] };
  return {
    label: activeIds.length === 1 ? "O locatie" : `${activeIds.length} locatii`,
    locations: activeIds.map((id) => locationName(locById[id])).filter(Boolean),
  };
}

function Drawer({ open, title, subtitle, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-[2px]">
      <button type="button" aria-label="Inchide" className="min-w-0 flex-1 cursor-default" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[480px] flex-col border-l border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-5">
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-extrabold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background hover:bg-secondary" aria-label="Inchide">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export default function ProviderAccess({ locations = [] }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(null);
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: "", role: "location_staff", location_ids: [] });

  const locById = useMemo(() => Object.fromEntries(locations.map((location) => [location.id, location])), [locations]);

  const load = async () => {
    setLoading(true);
    setMessage("");
    const response = await base44.functions.invoke("getMyProviderMembers", {}).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setLoading(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      setData({ members: [], invitations: [], manageable_location_ids: [], current_user_role_by_location: {}, can_manage_members: false, counters: {} });
      return;
    }
    setData(response.data || {});
  };

  useEffect(() => { load(); }, []);

  const memberGroups = useMemo(() => groupMembers(data?.members || []), [data?.members]);
  const invitations = data?.invitations || [];
  const manageableLocationIds = data?.manageable_location_ids || [];
  const allVisibleLocationIds = [...new Set((data?.members || []).map((membership) => membership.location_id).filter(Boolean))];
  const locationOptions = manageableLocationIds.map((id) => locById[id]).filter(Boolean);
  const ownerLocationIds = Object.entries(data?.current_user_role_by_location || {}).filter(([, role]) => role === "organization_owner").map(([id]) => id);
  const isOwnerAnywhere = ownerLocationIds.length > 0;
  const availableRoles = isOwnerAnywhere ? ROLE_ORDER : ["location_staff"];

  const filteredMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return memberGroups;
    return memberGroups.filter((group) => {
      const locationLabels = group.memberships.map((membership) => locationName(locById[membership.location_id])).join(" ");
      return [group.user_name, group.user_email_masked, locationLabels, ...group.memberships.map((membership) => ROLE_LABELS[membership.role] || membership.role)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [memberGroups, query, locById]);

  const filteredInvitations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invitations;
    return invitations.filter((invitation) => {
      const locationLabels = (invitation.invited_location_ids || []).map((id) => locationName(locById[id])).join(" ");
      return [invitation.invited_email_masked, ROLE_LABELS[invitation.proposed_role] || invitation.proposed_role, locationLabels].join(" ").toLowerCase().includes(needle);
    });
  }, [invitations, query, locById]);

  const resetInvite = () => {
    setForm({ email: "", role: "location_staff", location_ids: [] });
    setNewLink("");
    setCopied(false);
    setMessage("");
  };

  const openInvite = () => {
    resetInvite();
    setInviteOpen(true);
  };

  const changeInviteRole = (role) => {
    setForm((current) => ({
      ...current,
      role,
      location_ids: role === "organization_owner" ? [...ownerLocationIds] : current.location_ids.filter((id) => manageableLocationIds.includes(id)),
    }));
  };

  const toggleInviteLocation = (id) => {
    if (form.role === "organization_owner") return;
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Introdu un email valid.");
      return;
    }
    if (form.location_ids.length === 0) {
      setMessage("Selecteaza cel putin o locatie.");
      return;
    }
    setSaving(true);
    const response = await base44.functions.invoke("createProviderMemberInvitation", {
      invited_email: email,
      proposed_role: form.role,
      invited_location_ids: form.location_ids,
      invitation_base_url: window.location.origin,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      return;
    }
    setNewLink(response.data?.invitation_link || "");
    setMessage(response.data?.email_sent ? "Invitatia a fost trimisa." : "Invitatia a fost creata. Copiaza linkul si trimite-l utilizatorului.");
    await load();
  };

  const revokeInvitation = async (invitationId) => {
    if (!window.confirm("Revoci aceasta invitatie?")) return;
    setSaving(true);
    setMessage("");
    const response = await base44.functions.invoke("revokeProviderMemberInvitation", { invitation_id: invitationId }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      return;
    }
    await load();
  };

  const changeRole = async (membership, role) => {
    setSaving(true);
    setMessage("");
    const response = await base44.functions.invoke("updateProviderMemberRole", { membership_id: membership.membership_id, proposed_role: role }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      return;
    }
    await load();
    setMemberOpen((current) => current ? {
      ...current,
      memberships: current.memberships.map((item) => item.membership_id === membership.membership_id ? { ...item, role } : item),
    } : current);
  };

  const toggleMembership = async (membership) => {
    const nextActive = membership.status !== "active";
    if (!window.confirm(nextActive ? "Reactivezi accesul pentru aceasta locatie?" : "Dezactivezi accesul pentru aceasta locatie?")) return;
    setSaving(true);
    setMessage("");
    const functionName = nextActive ? "reactivateProviderMember" : "deactivateProviderMember";
    const response = await base44.functions.invoke(functionName, { membership_id: membership.membership_id }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) {
      setMessage(response.data.error);
      return;
    }
    await load();
    setMemberOpen((current) => current ? {
      ...current,
      memberships: current.memberships.map((item) => item.membership_id === membership.membership_id ? { ...item, status: nextActive ? "active" : "inactive" } : item),
    } : current);
  };

  const canManageMembership = (membership) => data?.current_user_role_by_location?.[membership.location_id] === "organization_owner";

  if (loading && !data) return <div className="rounded-2xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">Se incarca utilizatorii si accesul...</div>;

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary"><ShieldCheck className="h-4.5 w-4.5" /></div>
              <div>
                <h1 className="font-heading text-2xl font-extrabold tracking-tight">Acces si utilizatori</h1>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Gestioneaza intr-un singur loc membrii organizatiei, rolurile lor si locatiile la care au acces.</p>
              </div>
            </div>
          </div>
          {data?.can_manage_members && (
            <button type="button" onClick={openInvite} className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
              <UserPlus className="h-4 w-4" /> Invita utilizator
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-secondary/35 px-4 py-3">
            <div className="text-[11px] font-semibold text-muted-foreground">Membri activi</div>
            <div className="mt-1 text-2xl font-extrabold">{data?.counters?.active_members_total ?? memberGroups.length}</div>
          </div>
          <div className="rounded-2xl bg-secondary/35 px-4 py-3">
            <div className="text-[11px] font-semibold text-muted-foreground">Manageri de locatie</div>
            <div className="mt-1 text-2xl font-extrabold">{data?.counters?.location_managers_count || 0}</div>
          </div>
          <div className="rounded-2xl bg-secondary/35 px-4 py-3">
            <div className="text-[11px] font-semibold text-muted-foreground">Invitatii in asteptare</div>
            <div className="mt-1 text-2xl font-extrabold">{invitations.length}</div>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className={`${inputCls} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta dupa nume, email, rol sau locatie..." />
          {query && <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>}
        </div>
      </section>

      {message && !inviteOpen && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{message}</div>}

      <section className="overflow-hidden rounded-[22px] border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2"><Users className="h-4 w-4" /><h2 className="text-sm font-bold">Membrii organizatiei</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Un utilizator poate avea acces la una sau la mai multe locatii.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{memberGroups.length} utilizatori</span>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nu exista membri care corespund cautarii.</div>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredMembers.map((group) => {
              const activeMemberships = group.memberships.filter((membership) => membership.status === "active");
              const role = highestRole(activeMemberships.length ? activeMemberships : group.memberships);
              const access = accessSummary(group, locations.map((location) => location.id), locById);
              const editable = group.memberships.some(canManageMembership);
              return (
                <div key={group.user_id} className="flex flex-col gap-4 px-5 py-4 transition hover:bg-secondary/10 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{initials(group.user_name || group.user_email_masked)}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{group.user_name || group.user_email_masked || "Utilizator"}</div>
                      {group.user_name && group.user_email_masked && <div className="mt-0.5 truncate text-xs text-muted-foreground">{group.user_email_masked}</div>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{ROLE_LABELS[role] || role}</span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${activeMemberships.length ? "bg-green-50 text-green-800" : "bg-secondary text-muted-foreground"}`}>{activeMemberships.length ? "Activ" : "Inactiv"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 lg:max-w-[420px]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {access.label}</div>
                    {access.locations.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{access.locations.slice(0, 3).map((name) => <span key={name} className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] text-muted-foreground">{name}</span>)}{access.locations.length > 3 && <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">+{access.locations.length - 3}</span>}</div>}
                  </div>

                  <button type="button" onClick={() => setMemberOpen(group)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold hover:bg-secondary">
                    {editable ? "Gestioneaza accesul" : "Vezi accesul"} <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4" /><h2 className="text-sm font-bold">Invitatii in asteptare</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Invitatiile apar aici pana cand sunt acceptate, expirate sau revocate.</p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold">{invitations.length} in asteptare</span>
        </div>

        {filteredInvitations.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">{query ? "Nu exista invitatii care corespund cautarii." : "Nu exista invitatii in asteptare."}</div>
        ) : (
          <div className="divide-y divide-border/70">
            {filteredInvitations.map((invitation) => {
              const invitedLocations = (invitation.invited_location_ids || []).map((id) => locationName(locById[id])).filter(Boolean);
              return (
                <div key={invitation.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{invitation.invited_email_masked}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[invitation.proposed_role] || invitation.proposed_role}</div>
                  </div>
                  <div className="min-w-0 flex-1 lg:max-w-[420px]">
                    <div className="text-xs font-semibold">{invitedLocations.length === locations.length && locations.length > 1 ? "Toate locatiile actuale" : `${invitedLocations.length} ${invitedLocations.length === 1 ? "locatie" : "locatii"}`}</div>
                    {invitedLocations.length > 0 && invitedLocations.length !== locations.length && <div className="mt-1 truncate text-xs text-muted-foreground">{invitedLocations.join(" · ")}</div>}
                  </div>
                  {invitation.expires_at && <div className="shrink-0 text-[11px] text-muted-foreground">Expira la {new Date(invitation.expires_at).toLocaleDateString("ro-RO")}</div>}
                  <button type="button" disabled={saving} onClick={() => revokeInvitation(invitation.id)} className="shrink-0 rounded-full border border-border px-3 py-2 text-xs font-semibold text-destructive hover:bg-secondary disabled:opacity-50">Revoca</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Drawer open={inviteOpen} title="Invita utilizator" subtitle="Alege rolul si una sau mai multe locatii inainte de trimiterea invitatiei." onClose={() => setInviteOpen(false)}>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Email utilizator</label>
            <input className={`${inputCls} mt-1.5`} placeholder="nume@email.ro" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground">Rol</div>
            <div className="mt-2 space-y-2">
              {availableRoles.map((role) => {
                const descriptions = {
                  organization_owner: "Acces complet la organizatie si la toate locatiile actuale.",
                  location_manager: "Poate gestiona continutul si operatiunile locatiilor selectate.",
                  location_staff: "Acces operational limitat la locatiile selectate.",
                };
                const selected = form.role === role;
                return (
                  <button key={role} type="button" onClick={() => changeInviteRole(role)} className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${selected ? "border-foreground/25 bg-secondary/45" : "border-border bg-card hover:bg-secondary/20"}`}>
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>{selected && <Check className="h-3 w-3" />}</span>
                    <span><span className="block text-sm font-bold">{ROLE_LABELS[role] || role}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{descriptions[role]}</span></span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-xs font-semibold text-muted-foreground">Acces la locatii</div><p className="mt-1 text-[11px] text-muted-foreground">Selecteaza una sau mai multe locatii.</p></div>
              {form.role !== "organization_owner" && locationOptions.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, location_ids: current.location_ids.length === locationOptions.length ? [] : locationOptions.map((location) => location.id) }))} className="text-[11px] font-semibold underline underline-offset-4">{form.location_ids.length === locationOptions.length ? "Sterge selectia" : "Selecteaza toate"}</button>}
            </div>
            <div className="mt-3 space-y-2">
              {locationOptions.map((location) => {
                const selected = form.location_ids.includes(location.id);
                return (
                  <button key={location.id} type="button" disabled={form.role === "organization_owner"} onClick={() => toggleInviteLocation(location.id)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left disabled:cursor-default ${selected ? "border-foreground/20 bg-secondary/40" : "border-border bg-card"}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? "border-foreground bg-foreground text-background" : "border-border"}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{locationName(location)}</span>{location.city && <span className="mt-0.5 block text-[11px] text-muted-foreground">{location.city}</span>}</span>
                  </button>
                );
              })}
              {locationOptions.length === 0 && <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">Nu exista locatii pe care le poti administra.</div>}
            </div>
          </div>

          {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">{message}</div>}

          {newLink && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-3">
              <div className="text-xs font-bold text-green-900">Linkul este afisat o singura data</div>
              <p className="mt-1 break-all text-xs leading-relaxed text-green-900/80">{newLink}</p>
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(newLink); setCopied(true); }} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1.5 text-xs font-semibold text-green-900">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copiat" : "Copiaza linkul"}
              </button>
            </div>
          )}

          <button type="button" disabled={saving || Boolean(newLink)} onClick={createInvitation} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50">
            <Send className="h-4 w-4" /> {saving ? "Se creeaza..." : "Trimite invitatia"}
          </button>
        </div>
      </Drawer>

      <Drawer open={Boolean(memberOpen)} title={memberOpen?.user_name || memberOpen?.user_email_masked || "Acces utilizator"} subtitle="Rolurile si accesul sunt configurate separat pentru fiecare locatie." onClose={() => setMemberOpen(null)}>
        {memberOpen && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{initials(memberOpen.user_name || memberOpen.user_email_masked)}</div>
                <div className="min-w-0"><div className="truncate text-sm font-bold">{memberOpen.user_name || "Utilizator"}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{memberOpen.user_email_masked}</div></div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2"><Building2 className="h-4 w-4" /><h3 className="text-sm font-bold">Acces pe locatii</h3></div>
              <div className="space-y-2">
                {memberOpen.memberships.map((membership) => {
                  const editable = canManageMembership(membership);
                  return (
                    <div key={membership.membership_id} className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><div className="truncate text-sm font-bold">{locationName(locById[membership.location_id])}</div><div className={`mt-1 text-[11px] font-semibold ${membership.status === "active" ? "text-green-700" : "text-muted-foreground"}`}>{membership.status === "active" ? "Acces activ" : "Acces inactiv"}</div></div>
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className="mt-3">
                        <label className="text-[11px] font-semibold text-muted-foreground">Rol in aceasta locatie</label>
                        <select disabled={!editable || saving} value={membership.role} onChange={(event) => changeRole(membership, event.target.value)} className={`${inputCls} mt-1.5 disabled:opacity-60`}>
                          {ROLE_ORDER.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}
                        </select>
                      </div>
                      {editable ? (
                        <button type="button" disabled={saving} onClick={() => toggleMembership(membership)} className={`mt-3 w-full rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${membership.status === "active" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-border hover:bg-secondary"}`}>{membership.status === "active" ? "Dezactiveaza accesul" : "Reactiveaza accesul"}</button>
                      ) : <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Nu ai permisiunea de a modifica accesul pentru aceasta locatie.</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/25 p-3 text-xs leading-relaxed text-muted-foreground">Pentru adaugarea unei persoane intr-o locatie noua, foloseste invitatia si selecteaza toate locatiile necesare. Modificarile de rol se aplica separat fiecarei locatii.</div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
