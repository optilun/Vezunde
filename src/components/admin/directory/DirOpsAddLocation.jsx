import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES_3C, PCS_LABELS } from "@/lib/directoryOpsCatalog";
import LocalityAutocomplete from "@/components/geo/LocalityAutocomplete";

const input = "w-full border border-input rounded-md px-3 py-2 text-sm bg-card";
const label = "block text-xs font-semibold text-muted-foreground mt-3 mb-1";

const EMPTY = {
  org_name: "", legal_name: "", org_website: "",
  name: "", provider_type: "", city: "", county: "", locality_siruta_code: "", address: "",
  phone_public: "", public_email: "", website: "", description: "", opening_hours: "",
  source_url: "", source_type: "site_oficial", source_name: "", source_checked_at: "", data_confidence: "medium", source_notes: "",
  mark_active: false,
};

export default function DirOpsAddLocation() {
  const [f, setF] = useState(EMPTY);
  const [duplicates, setDuplicates] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (forceCreate) => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await base44.functions.invoke("directoryOps", {
        action: "create_location",
        force_create: forceCreate === true,
        mark_active: f.mark_active,
        organization: { name: f.org_name, legal_name: f.legal_name, website: f.org_website },
        location: {
          name: f.name, provider_type: f.provider_type, city: f.city, county: f.county,
          locality_siruta_code: f.locality_siruta_code, address: f.address,
          phone_public: f.phone_public, public_email: f.public_email, website: f.website,
          description: f.description, opening_hours: f.opening_hours,
        },
        provenance: {
          source_url: f.source_url, source_type: f.source_type, source_name: f.source_name,
          source_checked_at: f.source_checked_at ? new Date(f.source_checked_at).toISOString() : "",
          data_confidence: f.data_confidence, source_notes: f.source_notes,
        },
      });
      if (res.data.duplicates) { setDuplicates(res.data.duplicates); setSaving(false); return; }
      setDuplicates(null);
      setF(EMPTY);
      setMessage({ ok: true, text: "Locatia a fost creata ca profil directory (fara servicii automate)." });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error || err.message });
    }
    setSaving(false);
  };

  const requiredMissing = !f.name || !f.provider_type || !f.city || !f.county || !f.address || !f.source_url || !f.source_checked_at || !f.org_name;

  return (
    <div className="max-w-2xl">
      <h2 className="font-heading font-bold">Organizatie</h2>
      <label className={label}>Nume organizatie *</label>
      <input className={input} value={f.org_name} onChange={set("org_name")} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Denumire legala</label><input className={input} value={f.legal_name} onChange={set("legal_name")} /></div>
        <div><label className={label}>Website organizatie</label><input className={input} value={f.org_website} onChange={set("org_website")} /></div>
      </div>

      <h2 className="font-heading font-bold mt-8">Locatie</h2>
      <label className={label}>Nume locatie *</label>
      <input className={input} value={f.name} onChange={set("name")} />
      <label className={label}>Tip furnizor *</label>
      <select className={input} value={f.provider_type} onChange={set("provider_type")}>
        <option value="">Alege...</option>
        {PROVIDER_TYPES_3C.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <label className={label}>Localitate (geografie canonica) *</label>
      <LocalityAutocomplete
        value={f.locality_siruta_code ? { display_label: `${f.city}${f.county ? ", " + f.county : ""}` } : null}
        onSelect={(loc) => setF({ ...f, locality_siruta_code: loc?.siruta_code || "", city: loc?.name || "", county: loc?.county_name || "" })}
      />
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Oras (oglinda)</label><input className={input} value={f.city} readOnly /></div>
        <div><label className={label}>Judet (oglinda)</label><input className={input} value={f.county} readOnly /></div>
      </div>
      <label className={label}>Adresa *</label>
      <input className={input} value={f.address} onChange={set("address")} />
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Telefon public</label><input className={input} value={f.phone_public} onChange={set("phone_public")} /></div>
        <div><label className={label}>Email public</label><input className={input} value={f.public_email} onChange={set("public_email")} /></div>
      </div>
      <label className={label}>Website locatie</label>
      <input className={input} value={f.website} onChange={set("website")} />
      <label className={label}>Program (text)</label>
      <input className={input} value={f.opening_hours} onChange={set("opening_hours")} />
      <label className={label}>Descriere</label>
      <textarea className={input} rows={2} value={f.description} onChange={set("description")} />

      <h2 className="font-heading font-bold mt-8">Provenienta (obligatoriu)</h2>
      <label className={label}>Sursa URL *</label>
      <input className={input} value={f.source_url} onChange={set("source_url")} placeholder="https://..." />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Tip sursa *</label>
          <select className={input} value={f.source_type} onChange={set("source_type")}>
            <option value="site_oficial">Site oficial</option>
            <option value="registru_public">Registru public</option>
            <option value="director_public">Director public</option>
            <option value="alta_sursa_publica">Alta sursa publica</option>
          </select>
        </div>
        <div><label className={label}>Verificat la data *</label><input type="date" className={input} value={f.source_checked_at} onChange={set("source_checked_at")} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Incredere date *</label>
          <select className={input} value={f.data_confidence} onChange={set("data_confidence")}>
            <option value="low">Scazuta</option><option value="medium">Medie</option><option value="high">Ridicata</option>
          </select>
        </div>
        <div><label className={label}>Nume sursa</label><input className={input} value={f.source_name} onChange={set("source_name")} /></div>
      </div>
      <label className={label}>Note sursa</label>
      <textarea className={input} rows={2} value={f.source_notes} onChange={set("source_notes")} />

      <label className="flex items-center gap-2 mt-4 text-sm">
        <input type="checkbox" checked={f.mark_active} onChange={set("mark_active")} />
        Marcheaza locatia ca activa (altfel ramane inactiva)
      </label>

      {duplicates && (
        <div className="mt-6 border border-destructive/40 bg-destructive/5 rounded-lg p-4">
          <p className="font-semibold text-sm">Posibile duplicate gasite — verifica inainte de creare:</p>
          <ul className="mt-2 space-y-1 text-sm">
            {duplicates.map((d) => (
              <li key={d.id} className="text-muted-foreground">
                {d.name} — {d.city}, {d.address} ({PCS_LABELS[d.profile_control_status] || d.profile_control_status})
                {d.match_reasons?.length > 0 && <span className="block text-xs">Motiv: {d.match_reasons.join(", ")}</span>}
              </li>
            ))}
          </ul>
          <div className="flex gap-3 mt-3">
            <button onClick={() => submit(true)} disabled={saving} className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold">Creeaza oricum</button>
            <button onClick={() => setDuplicates(null)} className="px-4 py-2 rounded-md bg-secondary text-sm">Anuleaza</button>
          </div>
        </div>
      )}

      {message && <p className={`mt-4 text-sm ${message.ok ? "text-green-700" : "text-destructive"}`}>{message.text}</p>}

      {!duplicates && (
        <button onClick={() => submit(false)} disabled={saving || requiredMissing} className="mt-6 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
          {saving ? "Se salveaza..." : "Creeaza profil directory"}
        </button>
      )}
      {requiredMissing && <p className="text-xs text-muted-foreground mt-2">Completeaza campurile obligatorii, inclusiv sursa URL si data verificarii sursei.</p>}
    </div>
  );
}