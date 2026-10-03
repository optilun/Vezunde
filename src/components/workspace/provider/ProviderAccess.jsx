import React, { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Copy, Mail, MapPin, Search, Send, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ROLE_LABELS } from "@/lib/workspaceStatusLabels";
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";
import { useProviderAccessState } from "./ProviderAccessContext";
import {
  PROVIDER_ACCESS_ROLES,
  PROVIDER_ROLE_DESCRIPTIONS,
  PROVIDER_ROLE_MATRIX,
  providerRoleCoversOrganization,
  providerRoleMatrixCell,
} from "../../../../shared/providerRolePolicy.js";

const inputCls = "w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-[15px] outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5";
// 2026-10-03 (structura conturilor, pasul 3): patru roluri, fara „owner selectiv”. Rolurile,
// descrierile si tabelul „Ce poate fiecare rol” vin din matricea comuna (shared/providerRolePolicy.js).
const ALL_ROLES = PROVIDER_ACCESS_ROLES;
const ROLE_DESCRIPTIONS = PROVIDER_ROLE_DESCRIPTIONS;

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
function groupWide(group) { return providerRoleCoversOrganization(groupRole(group)) || group.memberships.some((row) => row.status === "active" && row.organization_wide_access === true); }
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

// Tabelul „Ce poate fiecare rol”, din aceeași matrice pe care o aplică și serverul.
function RoleMatrix() {
  return (
    <details className="group mt-4 rounded-2xl border border-border bg-background/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
        Ce poate fiecare rol
        <ChevronRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="px-4 py-2.5 font-semibold text-muted-foreground"><span className="sr-only">Drept</span></th>
              {ALL_ROLES.map((role) => <th key={role} scope="col" className="px-3 py-2.5 font-bold">{ROLE_LABELS[role]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PROVIDER_ROLE_MATRIX.map((row) => (
              <tr key={row.key} className="border-b border-border/60 last:border-0">
                <th scope="row" className="px-4 py-2.5 font-medium">{row.label}</th>
                {ALL_ROLES.map((role) => {
                  const cell = providerRoleMatrixCell(row, role);
                  return (
                    <td key={role} className="px-3 py-2.5 text-muted-foreground">
                      {typeof cell === "string" ? cell : cell
                        ? <Check className="h-4 w-4 text-foreground" aria-label="Da" />
                        : <span aria-label="Nu">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
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

// 2026-10-03 (structura conturilor, pasul 2): aceeași invitație poate cere și afișarea publică ca
// specialist. Persoana primește un singur email și acceptă o singură dată.
function InviteSpecialistOption({ form, setForm, locationById }) {
  const accessLocationIds = form.location_ids || [];
  const toggle = (id) => setForm((current) => ({
    ...current,
    specialist_location_ids: current.specialist_location_ids.includes(id)
      ? current.specialist_location_ids.filter((item) => item !== id)
      : [...current.specialist_location_ids, id],
  }));
  return (
    <div className="rounded-2xl border border-border p-3.5">
      <label htmlFor="invite-specialist" className="flex cursor-pointer items-start gap-3">
        <input
          id="invite-specialist"
          type="checkbox"
          checked={form.specialist}
          onChange={(event) => setForm((current) => ({ ...current, specialist: event.target.checked, specialist_location_ids: event.target.checked ? accessLocationIds : [] }))}
          className="mt-1"
        />
        <span>
          <span className="block text-sm font-bold">Apare și public ca specialist</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Pentru optometriști, oftalmologi și opticieni. Apare pe pagina locației doar după ce profilul lui profesional e verificat de VIASEE și își dă acordul când acceptă invitația.</span>
        </span>
      </label>
      {form.specialist && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div>
            <label htmlFor="invite-specialist-type" className="text-xs font-semibold text-muted-foreground">Tip specialist</label>
            <select id="invite-specialist-type" className="mt-1.5 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 text-sm" value={form.professional_type} onChange={(event) => setForm((current) => ({ ...current, professional_type: event.target.value }))}>
              {Object.entries(PROFESSIONAL_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Apare public la</div>
            {accessLocationIds.length === 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground">Alege întâi locațiile de mai sus.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {accessLocationIds.map((id) => (
                  <LocationChoice key={id} location={locationById[id] || { id }} selected={form.specialist_location_ids.includes(id)} disabled={false} onToggle={() => toggle(id)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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
  const {
    data,
    loading,
    error: accessError,
    onRetry: onRetryAccess,
  } = useProviderAccessState();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(null);
  const [newLink, setNewLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ email: "", role: "location_staff", location_ids: [], specialist: false, professional_type: "optometrist", specialist_location_ids: [] });
  const [edit, setEdit] = useState({ role: "location_staff", location_ids: [] });
  const locationById = useMemo(() => Object.fromEntries(locations.map((location) => [location.id, location])), [locations]);

  useEffect(() => {
    setMessage("");
    setInviteOpen(false);
    setMemberOpen(null);
    setQuery("");
  }, [organizationId]);

  const refreshAfterMutation = async () => {
    await Promise.all([onRetryAccess?.(), onRefresh?.()]);
  };

  const groups = useMemo(() => groupMembers(data?.members || []), [data?.members]);
  const invitations = data?.invitations || [];
  const locationOptions = (data?.manageable_location_ids || []).map((id) => locationById[id]).filter(Boolean);
  const allLocationIds = locationOptions.map((location) => location.id);
  // Rolurile pe care actorul le poate da (proprietarul: toate; administratorul: manager și membru;
  // managerul: membru). Cineva se poate gestiona doar dacă rolul lui actual e în această listă.
  const availableRoles = data?.available_invitation_roles || [];
  const canManageRole = (role) => Boolean(role) && availableRoles.includes(role);
  const filteredGroups = groups.filter((group) => !query || [group.user_name, group.user_email_masked, ROLE_LABELS[groupRole(group)], ...activeLocationIds(group).map((id) => locationName(locationById[id]))].join(" ").toLowerCase().includes(query.toLowerCase()));
  const filteredInvitations = invitations.filter((invitation) => !query || [invitation.invited_email_masked, ROLE_LABELS[invitation.proposed_role]].join(" ").toLowerCase().includes(query.toLowerCase()));

  const applyRoleToForm = (role) => {
    const wide = providerRoleCoversOrganization(role);
    setForm((current) => ({ ...current, role, location_ids: wide ? allLocationIds : [], specialist_location_ids: wide && current.specialist ? allLocationIds : [] }));
  };
  const toggleFormLocation = (id) => setForm((current) => {
    const removing = current.location_ids.includes(id);
    return {
      ...current,
      location_ids: removing ? current.location_ids.filter((item) => item !== id) : [...current.location_ids, id],
      specialist_location_ids: removing
        ? current.specialist_location_ids.filter((item) => item !== id)
        : (current.specialist ? [...current.specialist_location_ids, id] : current.specialist_location_ids),
    };
  });
  const openInvite = () => {
    const role = availableRoles.includes("location_staff") ? "location_staff" : availableRoles[0];
    setForm({ email: "", role, location_ids: providerRoleCoversOrganization(role) ? allLocationIds : [], specialist: false, professional_type: "optometrist", specialist_location_ids: [] });
    setMessage(""); setNewLink(""); setCopied(false); setInviteOpen(true);
  };

  const createInvitation = async () => {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setMessage("Introdu un email valid."); return; }
    if (!form.location_ids.length) { setMessage("Selectează cel puțin o locație."); return; }
    const specialistLocationIds = form.specialist ? form.specialist_location_ids.filter((id) => form.location_ids.includes(id)) : [];
    if (form.specialist && !specialistLocationIds.length) { setMessage("Alege cel puțin o locație la care apare ca specialist."); return; }
    setSaving(true); setMessage("");
    const response = await base44.functions.invoke("createProviderMemberInvitation", {
      organization_id: organizationId,
      invited_email: email,
      proposed_role: form.role,
      invited_location_ids: form.location_ids,
      organization_wide_access: providerRoleCoversOrganization(form.role),
      invitation_base_url: window.location.origin,
      ...(form.specialist ? { specialist: { professional_type: form.professional_type, location_ids: specialistLocationIds } } : {}),
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setNewLink(response.data?.invitation_link || "");
    setMessage(response.data?.email_sent ? "Invitația a fost trimisă." : "Invitația a fost creată. Copiază linkul și trimite-l utilizatorului.");
    await refreshAfterMutation();
  };

  const revoke = async (id) => {
    if (!window.confirm("Revoci această invitație?")) return;
    setSaving(true);
    const response = await base44.functions.invoke("revokeProviderMemberInvitation", { invitation_id: id }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    await refreshAfterMutation();
  };

  const openMember = (group) => {
    const role = groupRole(group) || "location_staff";
    setEdit({ role, location_ids: providerRoleCoversOrganization(role) ? allLocationIds : activeLocationIds(group).filter((id) => allLocationIds.includes(id)) });
    setMessage(""); setMemberOpen(group);
  };
  const applyEditRole = (role) => {
    setEdit((current) => {
      const wide = providerRoleCoversOrganization(role);
      const wasWide = providerRoleCoversOrganization(current.role);
      return { ...current, role, location_ids: wide ? allLocationIds : (wasWide ? [] : current.location_ids) };
    });
  };
  const toggleEditLocation = (id) => setEdit((current) => ({ ...current, location_ids: current.location_ids.includes(id) ? current.location_ids.filter((item) => item !== id) : [...current.location_ids, id] }));
  const saveMember = async () => {
    if (!edit.location_ids.length && !window.confirm("Elimini accesul utilizatorului din toate locațiile?")) return;
    setSaving(true); setMessage("");
    const response = await base44.functions.invoke("setProviderMemberAccess", {
      user_id: memberOpen.user_id,
      organization_id: organizationId,
      organization_wide_access: providerRoleCoversOrganization(edit.role),
      assignments: edit.location_ids.map((location_id) => ({ location_id, role: edit.role })),
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setSaving(false);
    if (response.data?.error) { setMessage(response.data.error); return; }
    setMemberOpen(null); await refreshAfterMutation();
  };

  const currentMemberRole = memberOpen ? groupRole(memberOpen) : "";
  const canEditMember = canManageRole(currentMemberRole);
  const editRoles = availableRoles.length ? availableRoles : [];
  const formWide = providerRoleCoversOrganization(form.role);
  const editWide = providerRoleCoversOrganization(edit.role);

  if (loading && !data) return <div className="rounded-[20px] border border-foreground/10 bg-card px-5 py-8 text-sm text-muted-foreground">Se încarcă utilizatorii și accesul...</div>;

  const accessLoadError = Boolean(accessError);

  return (
    <div className="space-y-6">
      <section className="rounded-[20px] border border-foreground/10 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#eaf0fc] text-[#345bc8]"><ShieldCheck className="h-5 w-5" /></div><div><h1 className="font-heading text-[2rem] font-extrabold tracking-tight">Acces și utilizatori</h1><p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">Patru roluri. Proprietarul și administratorul lucrează în toată organizația, inclusiv în locațiile noi. Managerul și membrul lucrează doar în locațiile bifate.</p></div></div>{data?.can_manage_members && availableRoles.length > 0 && <button type="button" onClick={openInvite} className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"><UserPlus className="h-4 w-4" /> Invită utilizator</button>}</div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Membri activi", data?.counters?.active_members_total || 0], ["Proprietari", data?.counters?.organization_owners_count || 0], ["Administratori", data?.counters?.organization_admins_count || 0], ["Invitații", invitations.length]].map(([label, value]) => <div key={label} className="rounded-[18px] bg-[#f8f4ec]/70 px-4 py-4"><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-extrabold">{value}</div></div>)}</div>
        <div className="relative mt-4"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className={`${inputCls} pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută după nume, email, rol sau locație..." /></div>
        <RoleMatrix />
      </section>
      {accessLoadError && (
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>Unele date de acces nu au putut fi încărcate. Utilizatorii existenți nu au fost șterși.</span>
          <button type="button" onClick={() => void onRetryAccess?.()} className="inline-flex h-9 items-center justify-center rounded-full border border-amber-300 bg-background px-4 text-xs font-semibold hover:bg-amber-100">Reîncearcă</button>
        </div>
      )}
      {message && !inviteOpen && !memberOpen && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

      <section className="overflow-hidden rounded-[20px] border border-foreground/10 bg-card shadow-sm">
        <div className="flex justify-between border-b border-border px-5 py-4"><div><div className="flex items-center gap-2"><Users className="h-5 w-5" /><h2 className="text-lg font-bold">Membrii organizației</h2></div><p className="mt-1 text-sm text-muted-foreground">Un singur rol pentru fiecare persoană și locațiile în care lucrează.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{groups.length}</span></div>
        <div className="divide-y divide-border/70">{filteredGroups.length ? filteredGroups.map((group) => {
          const role = groupRole(group);
          const editable = canManageRole(role);
          return <div key={group.user_id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">{initials(group.user_name || group.user_email_masked)}</div><div className="min-w-0"><div className="truncate text-sm font-bold">{group.user_name || group.user_email_masked}</div><div className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[role] || "Fără rol"}</div></div></div><div className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" /><UserAccessSummary group={group} allIds={allLocationIds} locationById={locationById} /></div><button type="button" disabled={!editable} onClick={() => openMember(group)} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-45">{editable ? "Gestionează accesul" : (role === "organization_owner" || role === "organization_admin" ? "Gestionat de proprietar" : "Gestionat de administrator")}<ChevronRight className="h-3.5 w-3.5" /></button></div>;
        }) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nu există utilizatori care corespund căutării.</div>}</div>
      </section>

      <section className="overflow-hidden rounded-[20px] border border-foreground/10 bg-card shadow-sm"><div className="flex justify-between border-b border-border px-5 py-4"><div><div className="flex items-center gap-2"><Mail className="h-5 w-5" /><h2 className="text-lg font-bold">Invitații în așteptare</h2></div></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{invitations.length}</span></div><div className="divide-y divide-border/70">{filteredInvitations.length ? filteredInvitations.map((invitation) => { const canRevoke = canManageRole(invitation.proposed_role); return <div key={invitation.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{invitation.invited_email_masked}</div><div className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[invitation.proposed_role]}</div></div><div className="flex-1 text-sm font-semibold">{providerRoleCoversOrganization(invitation.proposed_role) || invitation.organization_wide_access ? "Toate locațiile, și cele viitoare" : `${invitation.invited_location_ids?.length || 0} ${(invitation.invited_location_ids?.length || 0) === 1 ? "locație" : "locații"}`}</div><button type="button" disabled={!canRevoke || saving} onClick={() => revoke(invitation.id)} className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-destructive disabled:opacity-45">{canRevoke ? "Revocă" : "Doar proprietarul"}</button></div>; }) : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nu există invitații în așteptare.</div>}</div></section>

      <Drawer open={inviteOpen} title="Invită utilizator" subtitle="Alege rolul și locațiile înainte de trimitere." onClose={() => setInviteOpen(false)}>
        <div className="space-y-5"><div><label className="text-xs font-semibold text-muted-foreground">Email</label><input className={`${inputCls} mt-1.5`} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="nume@email.ro" /></div><div><div className="text-xs font-semibold text-muted-foreground">Rol</div><div className="mt-2 space-y-2">{availableRoles.map((role) => <RoleChoice key={role} role={role} selected={form.role === role} onSelect={applyRoleToForm} />)}</div></div>{formWide && <div className="rounded-2xl bg-secondary/35 p-3 text-sm text-muted-foreground">{ROLE_LABELS[form.role]} primește automat toate locațiile organizației, inclusiv cele adăugate de acum înainte.</div>}<div><div className="flex justify-between"><div className="text-sm font-semibold">Locații</div>{!formWide && locationOptions.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, location_ids: current.location_ids.length === allLocationIds.length ? [] : allLocationIds }))} className="text-xs font-semibold underline">{form.location_ids.length === allLocationIds.length ? "Șterge selecția" : "Selectează toate"}</button>}</div><div className="mt-3 space-y-2">{locationOptions.map((location) => <LocationChoice key={location.id} location={location} selected={form.location_ids.includes(location.id)} disabled={formWide} onToggle={() => toggleFormLocation(location.id)} />)}</div></div><InviteSpecialistOption form={form} setForm={setForm} locationById={locationById} />{message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}{newLink && <div className="rounded-2xl border border-green-200 bg-green-50 p-3"><p className="break-all text-xs">{newLink}</p><button type="button" onClick={async () => { await navigator.clipboard.writeText(newLink); setCopied(true); }} className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copiat" : "Copiază linkul"}</button></div>}<button type="button" disabled={saving || Boolean(newLink)} onClick={createInvitation} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" />{saving ? "Se creează..." : "Trimite invitația"}</button></div>
      </Drawer>

      <Drawer open={Boolean(memberOpen)} title={memberOpen?.user_name || memberOpen?.user_email_masked || "Acces utilizator"} subtitle="Modifică rolul și locațiile utilizatorului." onClose={() => setMemberOpen(null)}>
        {memberOpen && <div className="space-y-5">{!canEditMember && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{currentMemberRole === "organization_owner" || currentMemberRole === "organization_admin" ? "Acest rol poate fi modificat numai de proprietar." : "Acest rol poate fi modificat numai de proprietar sau de administrator."}</div>}<div><div className="text-xs font-semibold text-muted-foreground">Rol</div><div className="mt-2 space-y-2">{editRoles.map((role) => <RoleChoice key={role} role={role} selected={edit.role === role} disabled={!canEditMember || saving} onSelect={applyEditRole} />)}</div></div>{editWide && <div className="rounded-2xl bg-secondary/35 p-3 text-sm text-muted-foreground">{ROLE_LABELS[edit.role]} lucrează în toate locațiile organizației, inclusiv în cele adăugate de acum înainte.</div>}<div><div className="flex justify-between"><div className="text-sm font-semibold">Locații</div>{!editWide && <button type="button" onClick={() => setEdit((current) => ({ ...current, location_ids: current.location_ids.length === allLocationIds.length ? [] : allLocationIds }))} className="text-xs font-semibold underline">{edit.location_ids.length === allLocationIds.length ? "Șterge selecția" : "Selectează toate"}</button>}</div><div className="mt-3 space-y-2">{locationOptions.map((location) => <LocationChoice key={location.id} location={location} selected={edit.location_ids.includes(location.id)} disabled={!canEditMember || saving || editWide} onToggle={() => toggleEditLocation(location.id)} />)}</div></div>{message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}<button type="button" disabled={saving || !canEditMember} onClick={saveMember} className="h-11 w-full rounded-full bg-foreground text-sm font-semibold text-background disabled:opacity-50">{saving ? "Se salvează..." : "Salvează accesul"}</button></div>}
      </Drawer>
    </div>
  );
}