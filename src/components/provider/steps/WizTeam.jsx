import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ContinueButton from "@/components/intake/ContinueButton";
import { TEAM_ROLES } from "@/lib/providerTaxonomy";

const inputCls = "w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-foreground/50";

export default function WizTeam({ data, update, next }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("optometrist");
  const [existing, setExisting] = useState([]);

  useEffect(() => {
    base44.entities.ProfessionalProfile.filter({ is_public: true }, "full_name", 100).then(setExisting).catch(() => {});
  }, []);

  const addNew = () => {
    if (!name.trim()) return;
    update({ team: [...data.team, { full_name: name.trim(), role, is_public: true }] });
    setName("");
  };

  const addExisting = (id) => {
    if (!id) return;
    const prof = existing.find((p) => p.id === id);
    if (!prof || data.team.some((m) => m.professional_id === id)) return;
    update({ team: [...data.team, { professional_id: id, full_name: prof.full_name, role: prof.role || "optometrist", is_public: true }] });
  };

  const remove = (idx) => update({ team: data.team.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-4 text-left">
      {data.team.length > 0 && (
        <div className="space-y-2">
          {data.team.map((m, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span>{m.full_name} · {TEAM_ROLES[m.role] || m.role}{m.professional_id ? " (profil existent)" : ""}</span>
              <button type="button" onClick={() => remove(idx)} aria-label="Sterge"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Nume (optional public)" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="rounded-xl border border-border bg-card px-3 text-sm outline-none" value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <button type="button" onClick={addNew} className="px-4 py-2 rounded-full border border-border text-xs font-semibold hover:border-foreground/40">
        Adauga persoana
      </button>
      {existing.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Sau alege un profesionist existent in Vezunde:</div>
          <select className={inputCls} defaultValue="" onChange={(e) => { addExisting(e.target.value); e.target.value = ""; }}>
            <option value="">Alege un profil existent</option>
            {existing.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {TEAM_ROLES[p.role] || p.role || ""}</option>)}
          </select>
        </div>
      )}
      <ContinueButton onClick={next} />
    </div>
  );
}