import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { SERVICE_CATALOG_3C } from "@/lib/directoryOpsCatalog";

const input = "w-full border border-input rounded-md px-3 py-2 text-sm bg-card";

export default function DirOpsServiceAdd({ location, onAdded }) {
  const [key, setKey] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [confirmedAt, setConfirmedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [publiclyListed, setPubliclyListed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const isSpecialized = SERVICE_CATALOG_3C.specialized_medical.some((s) => s.key === key);

  const submit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await base44.functions.invoke("directoryOps", {
        action: "add_service",
        location_id: location.id,
        service_key: key,
        service_source_url: sourceUrl,
        service_confirmed_at: confirmedAt ? new Date(confirmedAt).toISOString() : "",
        notes,
        set_publicly_listed: publiclyListed,
      });
      setKey(""); setSourceUrl(""); setConfirmedAt(""); setNotes(""); setPubliclyListed(false);
      setMessage({ ok: true, text: "Serviciu adaugat." });
      onAdded();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error || err.message });
    }
    setSaving(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mt-2">
      <select className={input} value={key} onChange={(e) => setKey(e.target.value)}>
        <option value="">Alege serviciul...</option>
        <optgroup label="General">
          {SERVICE_CATALOG_3C.general.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </optgroup>
        <optgroup label="Tehnic">
          {SERVICE_CATALOG_3C.technical.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </optgroup>
        <optgroup label="Medical specializat">
          {SERVICE_CATALOG_3C.specialized_medical.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </optgroup>
      </select>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <input className={input} placeholder="Sursa URL serviciu *" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        <input className={input} type="date" value={confirmedAt} onChange={(e) => setConfirmedAt(e.target.value)} />
      </div>
      <input className={`${input} mt-3`} placeholder="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <label className="flex items-center gap-2 mt-3 text-sm">
        <input type="checkbox" checked={publiclyListed} onChange={(e) => setPubliclyListed(e.target.checked)} />
        Marcheaza ca listat public (necesita sursa oficiala)
      </label>
      {isSpecialized && publiclyListed && (
        <p className="text-xs text-muted-foreground mt-2">Serviciile medicale specializate raman excluse de la matching pana la verificare Vezunde, chiar daca sunt listate public.</p>
      )}
      {message && <p className={`text-sm mt-2 ${message.ok ? "text-green-700" : "text-destructive"}`}>{message.text}</p>}
      <button onClick={submit} disabled={saving || !key || !sourceUrl || !confirmedAt} className="mt-3 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
        {saving ? "Se salveaza..." : "Adauga serviciu"}
      </button>
    </div>
  );
}