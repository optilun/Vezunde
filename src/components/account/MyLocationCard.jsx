import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AVAILABILITY_OPTIONS, VERIFICATION_STATE_LABELS } from "@/lib/providerTaxonomy";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none";

export default function MyLocationCard({ location, membership, onSaved }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const suspended = location.verification_state === "suspended";
  const [direct, setDirect] = useState({
    opening_hours: location.opening_hours || "",
    saturday_hours: location.saturday_hours || "",
    availability_status: location.availability_status || "necunoscuta",
  });
  const [staged, setStaged] = useState({
    phone_public: location.phone_public || "",
    address: location.address || "",
    description: location.description || "",
  });
  // Module 3F.2.2: locality changes only via canonical selection (null = unchanged).
  const [newLocality, setNewLocality] = useState(null);

  const save = async (payload, successMsg) => {
    setSaving(true);
    setMsg("");
    const res = await base44.functions.invoke("updateProviderLocation", { location_id: location.id, ...payload }).catch((e) => ({ data: { error: e.message } }));
    setSaving(false);
    if (res.data?.error) setMsg(res.data.error);
    else { setMsg(successMsg); onSaved && onSaved(); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">{location.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {location.city} · {VERIFICATION_STATE_LABELS[location.verification_state || "unclaimed"]} · rol: {membership.role === "owner" ? "proprietar" : "membru"}
            {location.pending_changes && <span className="ml-2 text-primary">Modificari in analiza</span>}
          </div>
        </div>
        {!suspended && (
          <button onClick={() => setOpen(!open)} className="text-xs font-semibold underline underline-offset-4 shrink-0">
            {open ? "Inchide" : "Editeaza"}
          </button>
        )}
      </div>
      {suspended && <p className="mt-2 text-xs text-destructive">Profil suspendat — datele sunt momentan doar in citire.</p>}

      {open && !suspended && (
        <div className="mt-4 space-y-5 text-left">
          <div>
            <div className="text-sm font-semibold mb-2">Program si disponibilitate (se aplica imediat)</div>
            <div className="space-y-2">
              <input className={inputCls} placeholder="Program (ex: L-V 9:00-18:00)" value={direct.opening_hours} onChange={(e) => setDirect({ ...direct, opening_hours: e.target.value })} />
              <input className={inputCls} placeholder="Program sambata" value={direct.saturday_hours} onChange={(e) => setDirect({ ...direct, saturday_hours: e.target.value })} />
              <select className={inputCls} value={direct.availability_status} onChange={(e) => setDirect({ ...direct, availability_status: e.target.value })}>
                <option value="necunoscuta">Disponibilitate nepublicata</option>
                {Object.entries(AVAILABILITY_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button disabled={saving} onClick={() => save({ direct }, "Program actualizat.")} className="px-4 py-2 rounded-full text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
                Salveaza programul
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Date publice (necesita aprobare admin)</div>
            <div className="space-y-2">
              <input className={inputCls} placeholder="Telefon public" value={staged.phone_public} onChange={(e) => setStaged({ ...staged, phone_public: e.target.value })} />
              <input className={inputCls} placeholder="Adresa" value={staged.address} onChange={(e) => setStaged({ ...staged, address: e.target.value })} />
              <textarea className={inputCls} rows={3} placeholder="Descriere" value={staged.description} onChange={(e) => setStaged({ ...staged, description: e.target.value })} />
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Localitate curenta: {location.city}{location.county ? `, ${location.county}` : ""} — schimbarea se face doar prin selectie din lista oficiala.
                </div>
                <LocalityAutocomplete value={newLocality} onSelect={setNewLocality} placeholder="Schimba localitatea (optional)" />
              </div>
              <button disabled={saving} onClick={() => save({ staged: { fields: { ...staged, ...(newLocality?.siruta_code ? { locality_siruta_code: newLocality.siruta_code } : {}) } } }, "Modificarile au fost trimise spre aprobare.")} className="px-4 py-2 rounded-full text-xs font-semibold border border-border disabled:opacity-50">
                Trimite spre aprobare
              </button>
            </div>
          </div>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
        </div>
      )}
    </div>
  );
}