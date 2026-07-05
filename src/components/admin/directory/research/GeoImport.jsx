import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import GeoImportPreview from "./GeoImportPreview";
import AdminCard from "@/components/admin/ui/AdminCard";

const CHUNK = 3000;

// MODULE 3F.2 - Admin-only preview + one-confirmation import of the approved SIRUTA CSV.
export default function GeoImport() {
  const [fileUrl, setFileUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runPreview = async () => {
    setBusy(true); setError(null); setResult(null); setPreview(null);
    try {
      const res = await base44.functions.invoke("geoImportOps", { action: "preview", file_url: fileUrl.trim() });
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setBusy(false);
  };

  const runImport = async () => {
    setBusy(true); setError(null); setProgress({ done: 0, total: preview.stats.total_rows });
    try {
      const startRes = await base44.functions.invoke("geoImportOps", { action: "commit_start", file_url: fileUrl.trim() });
      const { run_id, total_rows, first_import } = startRes.data;
      let created = 0, updated = 0;
      for (let start = 0; start < total_rows; start += CHUNK) {
        const res = await base44.functions.invoke("geoImportOps", { action: "commit_chunk", file_url: fileUrl.trim(), run_id, start, first_import });
        created += res.data.created; updated += res.data.updated;
        setProgress({ done: Math.min(start + CHUNK, total_rows), total: total_rows });
      }
      const fin = await base44.functions.invoke("geoImportOps", { action: "commit_finish", file_url: fileUrl.trim(), run_id, created, updated, first_import });
      setResult({ created, updated, deactivated: fin.data.deactivated });
      setPreview(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
    setProgress(null);
    setBusy(false);
  };

  return (
    <div className="max-w-3xl space-y-5">
      <AdminCard className="p-5">
        <h2 className="font-heading font-bold text-sm">Geografie Romania — import SIRUTA</h2>
        <p className="text-sm text-muted-foreground mt-1">Sursa canonica de geografie Vezunde. Importul valideaza checksum-ul aprobat inainte de orice scriere. Doar administratori.</p>
        <label className="block text-xs font-semibold text-muted-foreground mt-4 mb-1">URL fisier CSV aprobat *</label>
        <input className="w-full border border-input rounded-md px-3 py-2 text-sm bg-card" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." />
        <button onClick={runPreview} disabled={busy || !fileUrl.trim()} className="mt-3 px-4 py-2 rounded-md bg-secondary text-sm font-semibold disabled:opacity-40">
          {busy && !progress ? "Se valideaza..." : "Ruleaza preview"}
        </button>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </AdminCard>

      {preview && (
        <AdminCard className="p-5">
          <GeoImportPreview preview={preview} />
          {preview.all_pass && !result && (
            <button onClick={runImport} disabled={busy} className="mt-4 px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
              Confirma si importa {preview.stats.total_rows} localitati
            </button>
          )}
          {!preview.all_pass && (
            <p className="mt-4 text-sm text-destructive font-semibold">Importul este blocat: validarile critice nu trec.</p>
          )}
        </AdminCard>
      )}

      {(progress || result) && (
        <AdminCard className="p-5">
          {progress && <p className="text-sm text-muted-foreground">Se importa... {progress.done} / {progress.total} randuri</p>}
          {result && (
            <p className="text-sm text-green-700 font-semibold">
              Import finalizat: {result.created} create, {result.updated} actualizate, {result.deactivated || 0} dezactivate. Auditul importului a fost inregistrat.
            </p>
          )}
        </AdminCard>
      )}
    </div>
  );
}