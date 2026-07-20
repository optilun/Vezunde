import React, { useEffect, useMemo, useState } from "react";
import { Plus, Settings, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  if (roles.includes("location_manager")) return ROLE_LABELS.location_manager;
  if (roles.includes("location_staff")) return ROLE_LABELS.location_staff;
  return "Utilizator";
}

export default function ProviderTeamHeaderAccess() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    base44.functions.invoke("getMyProviderMembers", {})
      .then((response) => {
        if (!mounted) return;
        setData(response.data?.error ? null : response.data);
      })
      .catch(() => {
        if (mounted) setData(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const members = useMemo(() => groupMembers(data?.members || []), [data?.members]);
  const visibleMembers = members.slice(0, 3);
  const pendingInvitations = data?.invitations?.length || 0;

  if (!loading && !data?.can_manage_members) return null;

  const openSettings = () => navigate("/contul-meu?s=settings");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-full px-1.5 transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/15"
          aria-label="Utilizatori si acces"
          title="Utilizatori si acces"
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
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-1rem))] rounded-2xl p-0 shadow-xl">
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Utilizatori si acces</h2>
              <p className="mt-1 text-xs text-muted-foreground">{members.length} {members.length === 1 ? "utilizator activ" : "utilizatori activi"}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary"><Users className="h-4 w-4" /></span>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto px-2 py-2">
          {loading && <div className="px-3 py-5 text-sm text-muted-foreground">Se incarca utilizatorii...</div>}
          {!loading && members.length === 0 && <div className="px-3 py-5 text-sm text-muted-foreground">Nu exista alti utilizatori activi.</div>}
          {!loading && members.slice(0, 6).map((member) => (
            <div key={member.user_id || member.user_email_masked} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/45">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                {initials(member.user_name || member.user_email_masked)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{member.user_name || member.user_email_masked || "Utilizator"}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{roleLabel(member)}</div>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{member.memberships.length} {member.memberships.length === 1 ? "locatie" : "locatii"}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border bg-secondary/20 p-3">
          {pendingInvitations > 0 && <p className="mb-2 px-1 text-xs text-muted-foreground">{pendingInvitations} {pendingInvitations === 1 ? "invitatie in asteptare" : "invitatii in asteptare"}</p>}
          <button type="button" onClick={openSettings} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">
            <Settings className="h-4 w-4" /> Gestioneaza din Setari
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
