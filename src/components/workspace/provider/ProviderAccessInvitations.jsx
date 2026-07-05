import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { ROLE_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none";

export default function ProviderAccessInvitations({ locations = [] }) {
  const [data, setData] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [form, setForm] = useState({ email: "", role: "location_staff", location_ids: [] });
  const [newLink, setNewLink] = useState(null);
  const [msg, setMsg] = useState("");

  const locById = Object.fromEntries(locations.map((l) => [l.id, l]));

  const load = async () => {
    const membersRes = await base44.functions.invoke("getMyProviderMembers", {}).catch(() => ({ data: null }));
    setData(membersRes.data);
    const invRes = await base44.functions.invoke("listProviderMemberInvitations", {}).catch(() => ({ data: { invitations: [] } }));
    setInvitations(invRes.data?.invitations || []);
  };
  useEffect(() => { load(); }, []);

  if (!data) return <p className="text-sm text-muted-foreground">Se incarca...</p>;

  const isOwnerAnywhere = Object.values(data.current_user_role_by_location || {}).includes("organization_owner");
  const availableRoles = isOwnerAnywhere ? ["organization_owner", "location_manager", "location_staff"] : ["location_staff"];
  const locationOptions = data.manageable_location_ids || [];

  const toggleLoc = (id) => {
    setForm((f) => ({ ...f, location_ids: f.location_ids.includes(id) ? f.location_ids.filter((x) => x !== id) : [...f.location_ids, id] }));
  };

  const createInvitation = async () => {
    setMsg(""); setNewLink(null);
    if (!form.email || form.location_ids.length === 0) { setMsg("Email si cel putin o locatie sunt obligatorii."); return; }
    const res = await base44.functions.invoke("createProviderMemberInvitation", {
      invited_email: form.email, proposed_role: form.role, invited_location_ids: form.location_ids,
    }).catch((e) => ({ data: { error: e.message } }));
    if (res.data?.error) { setMsg(res.data.error); return; }
    setNewLink(res.data.invitation_link);
    setForm({ email: "", role: "location_staff", location_ids: [] });
    load();
  };

  const revoke = async (id) => {
    const res = await base44.functions.invoke("revokeProviderMemberInvitation", { invitation_id: id }).catch((e) => ({ data: { error: e.message } }));
    if (res.data?.error) { setMsg(res.data.error); return; }
    load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="font-semibold text-sm">Invita membru nou</div>
        <input className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {availableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          {locationOptions.map((id) => (
            <button key={id} type="button" onClick={() => toggleLoc(id)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${form.location_ids.includes(id) ? "bg-foreground text-white border-foreground" : "border-border text-muted-foreground"}`}>
              {locById[id]?.name || id.slice(0, 8)}
            </button>
          ))}
        </div>
        <button onClick={createInvitation} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: "#171717" }}>Trimite invitatia</button>
        {msg && <p className="text-xs text-destructive">{msg}</p>}
        {newLink && (
          <div className="rounded-lg bg-secondary p-3 text-xs space-y-2">
            <p className="font-semibold">Linkul este afisat o singura data.</p>
            <p className="break-all text-muted-foreground">{newLink}</p>
            <button onClick={() => navigator.clipboard.writeText(newLink)} className="px-3 py-1.5 rounded-full border border-border font-semibold">Copiaza</button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="font-semibold text-sm">Invitatii in asteptare</div>
        {invitations.length === 0 && <p className="text-sm text-muted-foreground">Nicio invitatie in asteptare.</p>}
        {invitations.map((inv) => (
          <div key={inv.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-sm">{inv.invited_email_masked}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[inv.proposed_role] || inv.proposed_role}</div>
            </div>
            <button onClick={() => revoke(inv.id)} className="text-xs font-semibold text-destructive underline underline-offset-4 shrink-0">Revoca</button>
          </div>
        ))}
      </div>
    </div>
  );
}