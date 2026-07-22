import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ROLE_LABELS } from "@/lib/workspaceStatusLabels";

function initials(value = "") {
  return String(value || "U")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

function groupMembers(rows = []) {
  const groups = new Map();
  rows.forEach((membership) => {
    if (membership.status !== "active") return;
    const key = membership.user_id || membership.membership_id;
    if (!key) return;
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

function roleLabel(group) {
  const roles = [...new Set(group.memberships.map((membership) => membership.role).filter(Boolean))];
  if (roles.includes("organization_owner")) return ROLE_LABELS.organization_owner;
  if (roles.includes("organization_admin")) return ROLE_LABELS.organization_admin;
  if (roles.includes("location_manager")) return ROLE_LABELS.location_manager;
  if (roles.includes("location_staff")) return ROLE_LABELS.location_staff;
  return "Utilizator";
}

function selectedOrganizationIdFor(data, userId, locationId) {
  const rows = data?.members || [];
  const ownLocationMembership = rows.find((membership) => (
    membership.user_id === userId
    && membership.location_id === locationId
    && membership.organization_id
  ));
  if (ownLocationMembership?.organization_id) return ownLocationMembership.organization_id;

  const locationMembership = rows.find((membership) => (
    membership.location_id === locationId && membership.organization_id
  ));
  if (locationMembership?.organization_id) return locationMembership.organization_id;

  const manageableOrganizationIds = data?.manageable_organization_ids || [];
  return manageableOrganizationIds.length === 1 ? manageableOrganizationIds[0] : "";
}

export default function ProviderTeamHeaderAccess({ userId = "", locationId = "" }) {
  const rootRef = useRef(null);
  const requestRef = useRef(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    const requestId = ++requestRef.current;
    if (!silent) setLoading(true);
    const response = await base44.functions.invoke("getMyProviderMembers", {})
      .catch(() => ({ data: null }));
    if (requestId !== requestRef.current) return;
    if (response.data?.error) { setData(null); setLoadError(true); }
    else { setData(response.data); setLoadError(false); }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return () => { requestRef.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    void load({ silent: true });
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [load, open]);

  const selectedOrganizationId = useMemo(
    () => selectedOrganizationIdFor(data, userId, locationId),
    [data, locationId, userId],
  );
  const manageableOrganizationIds = data?.manageable_organization_ids || [];
  const canManageCurrentOrganization = Boolean(
    data?.can_manage_members
    && selectedOrganizationId
    && manageableOrganizationIds.includes(selectedOrganizationId),
  );
  const scopedMemberships = useMemo(() => (
    selectedOrganizationId
      ? (data?.members || []).filter((membership) => membership.organization_id === selectedOrganizationId)
      : []
  ), [data?.members, selectedOrganizationId]);
  const scopedInvitations = useMemo(() => (
    selectedOrganizationId
      ? (data?.invitations || []).filter((invitation) => invitation.organization_id === selectedOrganizationId)
      : []
  ), [data?.invitations, selectedOrganizationId]);
  const members = useMemo(() => groupMembers(scopedMemberships), [scopedMemberships]);
  const visibleMembers = members.slice(0, 3);
  const pendingInvitations = scopedInvitations.length;

  if (!loading && !loadError && !canManageCurrentOrganization) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-10 items-center rounded-full px-1.5 transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
        aria-label="Utilizatori și acces"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="provider-team-header-panel"
        title="Utilizatori și acces"
      >
        <span className="hidden items-center -space-x-2 sm:flex">
          {loading && <span className="h-8 w-8 animate-pulse rounded-full border-2 border-card bg-secondary" />}
          {!loading && visibleMembers.map((member, index) => (
            <span
              key={member.user_id || member.user_email_masked || index}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-[10px] font-bold text-background shadow-sm"
              title={member.user_name || member.user_email_masked || "Utilizator"}
            >
              {initials(member.user_name || member.user_email_masked)}
            </span>
          ))}
          {!loading && members.length > 3 && (
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-card bg-secondary px-1.5 text-[10px] font-bold text-foreground shadow-sm">+{members.length - 3}</span>
          )}
        </span>
        <span className="ml-0 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm sm:ml-1" aria-hidden="true">
          <Plus className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div
          id="provider-team-header-panel"
          role="dialog"
          aria-label="Utilizatorii organizației"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-xl"
        >
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Utilizatori și acces</h2>
                <p className="mt-1 text-xs text-muted-foreground">{members.length} {members.length === 1 ? "utilizator activ" : "utilizatori activi"}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Users className="h-4 w-4" /></span>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto px-2 py-2">
            {loading && <div className="px-3 py-5 text-sm text-muted-foreground">Se încarcă utilizatorii...</div>}
            {!loading && loadError && (
              <div className="flex flex-col gap-2 px-3 py-5 text-sm text-muted-foreground">
                <span>Datele de acces nu au putut fi încărcate.</span>
                <button type="button" onClick={() => void load()} className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary">Reîncearcă</button>
              </div>
            )}
            {!loading && !loadError && members.length === 0 && <div className="px-3 py-5 text-sm text-muted-foreground">Nu există alți utilizatori activi.</div>}
            {!loading && members.slice(0, 6).map((member) => (
              <div key={member.user_id || member.user_email_masked} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/45">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                  {initials(member.user_name || member.user_email_masked)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{member.user_name || member.user_email_masked || "Utilizator"}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{roleLabel(member)}</div>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{member.memberships.length} {member.memberships.length === 1 ? "locație" : "locații"}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-secondary/20 p-3">
            {pendingInvitations > 0 && <p className="mb-2 px-1 text-xs text-muted-foreground">{pendingInvitations} {pendingInvitations === 1 ? "invitație în așteptare" : "invitații în așteptare"}</p>}
            <a href="/contul-meu?s=access" className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
              <Users className="h-4 w-4" /> Gestionează accesul
            </a>
          </div>
        </div>
      )}
    </div>
  );
}