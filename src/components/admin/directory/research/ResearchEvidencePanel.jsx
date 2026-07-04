import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { EVIDENCE_CONFIDENCE_LABELS, EVIDENCE_STATUS_LABELS } from "@/lib/researchCatalog";

const input = "w-full border border-input rounded-md px-2.5 py-1.5 text-sm bg-card";
const label = "block text-xs font-semibold text-muted-foreground mt-2 mb-1";

const EMPTY = { target: "", field_name: "", value_snapshot: "", source_url: "", source_type: "site_oficial", source_title: "", checked_at: "", confidence: "medium", notes: "", supersede_previous: false };

export default function ResearchEvidencePanel({ location, organization, services, evidence, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const targets = [
    { key: `ProviderLocation:${location.id}`, label: `Locatie: ${location.name}` },
    ...(organization ? [{ key: `ProviderOrganization:${organization.id}`, label: `Organizatie: ${organization.name}` }] : []),
    ...services.map((s) => ({ key: `LocationService:${s.id}`, label: `Serviciu: ${s.service_key}` })),
  ];
  const targetLabel = (e) => targets.find((t) => t.key === `${e.entity_type}:${e.entity_id}`)?.label || `${e.entity_type}`;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const [entity_type, entity_id] = f.target.split(":");
      await base44.functions.invoke("researchOps", {
        action: "add_evidence",
        entity_type, entity_id,
        field_name: f.field_name, value_snapshot: f.value_snapshot,
        source_url: f.source_url, source_type: f.source_type, source_title: f.source_title,
        checked_at: f.checked_at ? new Date(f.checked_at).toISOString() : "",
        confidence: f.confidence, notes: f.notes,
        supersede_previous: f.supersede_previous,
      });
      setF(EMPTY);
      setShowForm(false);
      await onReload();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setSaving(false);
  };

  const setStatus = async (evidenceId, status) => {
    const note = status === "rejected" ? window.prompt("Nota pentru respingerea dovezii (obligatorie):") : window.prompt("Nota (optional):") || "";
    if (status === "rejected" && !note) return;
    setError(null);
    try {
      await base44.functions.invoke("researchOps", { action: "set_evidence_status", evidence_id: evidenceId, status, note });
      await onReload();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-sm">D. Dovezi per camp/serviciu ({evidence.length})</h3>
        <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold">
          {showForm ? "Inchide formular" : "Adauga dovada"}
        </button>
      </div>

      {showForm && (
        <div className="mt-4 border border-border rounded-lg p-4 max-w-xl">
          <label className={label}>Tinta dovezii *</label>
          <select className={input} value={f.target} onChange={set("target")}>
            <option value="">Alege...</option>
            {targets.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Camp (field_name)</label><input className={input} value={f.field_name} onChange={set("field_name")} placeholder="ex: phone_public" /></div>
            <div><label className={label}>Valoare (snapshot)</label><input className={input} value={f.value_snapshot} onChange={set("value_snapshot")} /></div>
          </div>
          <label className={label}>Sursa URL * (fara Google Maps/Places)</label>
          <input className={input} value={f.source_url} onChange={set("source_url")} placeholder="https://..." />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Tip sursa</label>
              <select className={input} value={f.source_type} onChange={set("source_type")}>
                <option value="site_oficial">Site oficial</option>
                <option value="registru_public">Registru public</option>
                <option value="director_public">Director public</option>
                <option value="alta_sursa_publica">Alta sursa publica</option>
              </select>
            </div>
            <div><label className={label}>Titlu sursa (optional)</label><input className={input} value={f.source_title} onChange={set("source_title")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={label}>Verificat la data</label><input type="date" className={input} value={f.checked_at} onChange={set("checked_at")} /></div>
            <div>
              <label className={label}>Incredere *</label>
              <select className={input} value={f.confidence} onChange={set("confidence")}>
                <option value="low">Scazuta</option><option value="medium">Medie</option><option value="high">Ridicata</option>
              </select>
            </div>
          </div>
          <label className={label}>Note</label>
          <textarea className={input} rows={2} value={f.notes} onChange={set("notes")} />
          <label className="flex items-center gap-2 mt-2 text-xs">
            <input type="checkbox" checked={f.supersede_previous} onChange={set("supersede_previous")} />
            Marcheaza dovezile active anterioare pentru acelasi camp ca inlocuite
          </label>
          <button onClick={submit} disabled={saving || !f.target || !f.source_url} className="mt-3 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40">
            {saving ? "Se salveaza..." : "Salveaza dovada"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {evidence.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Nicio dovada inregistrata.</p> : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Tinta</th>
                <th className="py-2 pr-3">Camp</th>
                <th className="py-2 pr-3">Valoare</th>
                <th className="py-2 pr-3">Sursa</th>
                <th className="py-2 pr-3">Incredere</th>
                <th className="py-2 pr-3">Verificat</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {evidence.map((e) => (
                <tr key={e.id} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3">{targetLabel(e)}</td>
                  <td className="py-2 pr-3">{e.field_name || "—"}</td>
                  <td className="py-2 pr-3">{e.value_snapshot || "—"}</td>
                  <td className="py-2 pr-3 max-w-[220px] break-all">
                    <a href={e.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{e.source_url}</a>
                    {e.source_title && <span className="block text-muted-foreground">{e.source_title}</span>}
                  </td>
                  <td className="py-2 pr-3">{EVIDENCE_CONFIDENCE_LABELS[e.confidence] || e.confidence || "—"}</td>
                  <td className="py-2 pr-3">{e.checked_at ? e.checked_at.slice(0, 10) : "—"}</td>
                  <td className="py-2 pr-3">{EVIDENCE_STATUS_LABELS[e.evidence_status] || e.evidence_status}</td>
                  <td className="py-2">
                    {e.evidence_status === "active" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => setStatus(e.id, "superseded")} className="px-2 py-1 rounded bg-secondary">Inlocuita</button>
                        <button onClick={() => setStatus(e.id, "rejected")} className="px-2 py-1 rounded bg-destructive/10 text-destructive">Respinge</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}