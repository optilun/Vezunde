import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import ContinueButton from "@/components/intake/ContinueButton";
import { PROFESSIONAL_TYPES } from "@/lib/vezunde";

export default function OnbTeam({ data, update, onNext }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");

  const add = () => {
    if (!name.trim() || !type) return;
    update({ team: [...data.team, { full_name: name.trim(), professional_type: type }] });
    setName("");
    setType("");
  };

  return (
    <div>
      <div className="space-y-2">
        {data.team.map((m, i) => (
          <div key={i} className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
            <div>
              <div className="text-sm font-medium">{m.full_name}</div>
              <div className="text-xs text-muted-foreground">{PROFESSIONAL_TYPES[m.professional_type]}</div>
            </div>
            <button type="button" onClick={() => update({ team: data.team.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 bg-card border border-border rounded-2xl p-4 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nume si prenume"
          className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-foreground/40"
        />
        <div className="flex flex-wrap gap-2">
          {Object.entries(PROFESSIONAL_TYPES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={`px-3.5 py-2 rounded-full border text-sm transition-all ${
                type === key ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={add} disabled={!name.trim() || !type} className="inline-flex items-center gap-1.5 text-sm font-semibold disabled:opacity-40">
          <Plus className="w-4 h-4" /> Adauga persoana
        </button>
      </div>
      <ContinueButton onClick={() => onNext()} disabled={data.team.length === 0} />
    </div>
  );
}