import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ROLE_LABELS } from "@/lib/workspaceStatusLabels";

export default function ProviderAccessMembers() {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const res = await base44.functions.invoke("getMyProviderMembers", {}).catch(() => ({ data: null }));
    setData(res.data);
  };
  useEffect(() => { load(); }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Se incarca...</p>;

  const canManage = data.can_manage_members;
  const isOwnerOf = (m) => data.current_user_role_by_location?.[m.location_id] === "organization_owner";

  const changeRole = async (m, role) => {
    setMsg("");
    const res = await base44.functions.invoke("updateProviderMemberRole", { membership_id: m.membership_id, proposed_role: role }).catch((e) => ({ data: { error: e.message } }));
    if (res.data?.error) { setMsg(res.data.error); return; }
    load();
  };

  const toggleActive = async (m) => {
    setMsg("");
    const fn = m.status === "active" ? "deactivateProviderMember" : "reactivateProviderMember";
    const res = await base44.functions.invoke(fn, { membership_id: m.membership_id }).catch((e) => ({ data: { error: e.message } }));
    if (res.data?.error) { setMsg(res.data.error); return; }
    load();
  };

  return (
    <div className="space-y-3">
      {msg && <p className="text-xs text-destructive">{msg}</p>}
      {data.members.length === 0 && <p className="text-sm text-muted-foreground">Niciun membru.</p>}
      {data.members.map((m) => (
        <div key={m.membership_id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">{m.user_name || m.user_email_masked}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[m.role] || m.role} · {m.status === "active" ? "Activ" : "Inactiv"}</div>
          </div>
          {canManage && isOwnerOf(m) && (
            <div className="flex items-center gap-2 shrink-0">
              <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} className="text-xs rounded-lg border border-border px-2 py-1.5">
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => toggleActive(m)} className="text-xs font-semibold underline underline-offset-4">
                {m.status === "active" ? "Dezactiveaza" : "Reactiveaza"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}