import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { PROVIDER_TYPES_3C, PCS_LABELS } from "@/lib/directoryOpsCatalog";
import { RESEARCH_STATUS_LABELS, MISSING_FIELD_LABELS } from "@/lib/researchCatalog";

const input = "border border-input rounded-md px-2 py-1.5 text-xs bg-card";
const EMPTY = { city: "", county: "", provider_type: "", research_status: "", profile_control_status: "", source_completeness: "", checked_before: "", missing_services: false, migration_review_required: false };

export default function ResearchQueue({ onOpen }) {
  const [f, setF] = useState(EMPTY);
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("researchOps", {
        action: "queue",
        filters: { ...filters, checked_before: filters.checked_before ? new Date(filters.checked_before).toISOString() : "" },
      });
      setRows(res.data.rows || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(EMPTY); }, [load]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <input className={input} placeholder="Oras" value={f.city} onChange={set("city")} />
        <input className={input} placeholder="Judet" value={f.county} onChange={set("county")} />
        <select className={input} value={f.provider_type} onChange={set("provider_type")}>
          <option value="">Tip furnizor</option>
          {PROVIDER_TYPES_3C.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select className={input} value={f.research_status} onChange={set("research_status")}>
          <option value="">Status research</option>
          {Object.entries(RESEARCH_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={input} value={f.profile_control_status} onChange={set("profile_control_status")}>
          <option value="">Status profil</option>
          {Object.entries(PCS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={input} value={f.source_completeness} onChange={set("source_completeness")}>
          <option value="">Completitudine surse</option>
          <option value="no_source">Fara sursa pe profil</option>
          <option value="no_evidence">Fara dovezi active</option>
          <option value="has_source">Cu sursa sau dovezi</option>
        </select>
        <div>
          <div className="text-[10px] text-muted-foreground mb-0.5">Neverificat dupa</div>
          <input type="date" className={input} value={f.checked_before} onChange={set("checked_before")} />
        </div>
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.missing_services} onChange={set("missing_services")} /> Fara servicii</label>
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={f.migration_review_required} onChange={set("migration_review_required")} /> Review migrare</label>
        <button onClick={() => load(f)} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold">Filtreaza</button>
        <button onClick={() => { setF(EMPTY); load(EMPTY); }} className="px-3 py-1.5 rounded-md bg-secondary text-xs">Reseteaza</button>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      {loading && <p className="mt-4 text-sm text-muted-foreground">Se incarca...</p>}
      {!loading && rows && rows.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Nicio locatie nu corespunde filtrelor.</p>}

      {!loading && rows && rows.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Organizatie</th>
                <th className="py-2 pr-3">Locatie</th>
                <th className="py-2 pr-3">Oras</th>
                <th className="py-2 pr-3">Tip</th>
                <th className="py-2 pr-3">Profil</th>
                <th className="py-2 pr-3">Research</th>
                <th className="py-2 pr-3">Surse</th>
                <th className="py-2 pr-3">Ultima verificare</th>
                <th className="py-2 pr-3">Campuri lipsa</th>
                <th className="py-2 pr-3">Responsabil</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3">{r.organization || "—"}</td>
                  <td className="py-2 pr-3 font-medium">{r.name}</td>
                  <td className="py-2 pr-3">{r.city}</td>
                  <td className="py-2 pr-3">{PROVIDER_TYPES_3C.find((t) => t.key === r.provider_type)?.label || r.provider_type}</td>
                  <td className="py-2 pr-3">{PCS_LABELS[r.profile_control_status] || r.profile_control_status}</td>
                  <td className="py-2 pr-3">{RESEARCH_STATUS_LABELS[r.research_status] || r.research_status}</td>
                  <td className="py-2 pr-3">{r.active_sources}</td>
                  <td className="py-2 pr-3">{r.last_checked ? r.last_checked.slice(0, 10) : "niciodata"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.missing_fields.length > 0 ? r.missing_fields.map((k) => MISSING_FIELD_LABELS[k] || k).join(", ") : "—"}</td>
                  <td className="py-2 pr-3">{r.assigned_to || "—"}</td>
                  <td className="py-2">
                    <button onClick={() => onOpen(r.id)} className="px-2.5 py-1 rounded-md bg-secondary hover:bg-accent font-semibold">Deschide</button>
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