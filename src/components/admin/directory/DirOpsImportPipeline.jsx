import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Database,
  FileCheck2,
  FileUp,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  detectDirectorySourceFormat,
  parseDirectorySource,
  sha256Hex,
  sourceColumns,
} from "@/lib/directoryImportFileParser";

const CHUNK_SIZE = 100;
const STATUS_LABELS = {
  draft: "Draft",
  uploading: "Se incarca",
  validating: "Se valideaza",
  ready: "Pregatit",
  blocked: "Blocat",
  imported: "Importat",
  archived: "Arhivat",
  planning: "Dry-run in lucru",
  approved: "Aprobat",
  running: "Import in lucru",
  completed: "Finalizat",
  completed_with_errors: "Finalizat cu erori",
  failed: "Esuat",
  rolling_back: "Rollback in lucru",
  rolled_back: "Retras",
  rollback_failed: "Rollback incomplet",
};

const ROW_STATUS_OPTIONS = [
  { value: "", label: "Toate randurile" },
  { value: "blocked", label: "Blocate" },
  { value: "ready", label: "Pregatite" },
  { value: "failed", label: "Esuate" },
  { value: "applied", label: "Aplicate" },
  { value: "skipped", label: "Sarite" },
];

const OVERRIDE_FIELDS = [
  ["location_name", "Nume locatie"],
  ["organization_name", "Organizatie"],
  ["locality_name", "Localitate"],
  ["county_name", "Judet"],
  ["locality_siruta_code", "Cod SIRUTA"],
  ["address", "Adresa"],
  ["provider_type", "Provider type"],
  ["provider_profile_type", "Profile type"],
  ["location_type_code", "Tip canonic locatie"],
  ["care_setting_code", "Mediu de ingrijire"],
  ["source_url", "Sursa oficiala"],
];

function statusTone(status) {
  if (["ready", "completed", "imported", "rolled_back"].includes(status)) return "border-green-200 bg-green-50 text-green-900";
  if (["blocked", "failed", "rollback_failed", "completed_with_errors"].includes(status)) return "border-red-200 bg-red-50 text-red-900";
  if (["uploading", "validating", "planning", "approved", "running", "rolling_back"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-border bg-secondary/40 text-foreground";
}

function formatDate(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("ro-RO"); } catch { return "—"; }
}

function parseJson(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function invoke(payload) {
  return base44.functions.invoke("directoryImportOps", payload)
    .then((response) => response.data)
    .catch((error) => ({ error: error.response?.data?.error || error.message || "Operatia a esuat." }));
}

function ProgressBar({ value = 0, total = 0 }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground"><span>{value} din {total}</span><span>{percent}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
    </div>
  );
}

function Stat({ label, value, tone = "" }) {
  return <div className={`rounded-2xl border border-border bg-background px-3 py-3 ${tone}`}><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-xl font-extrabold">{value ?? 0}</div></div>;
}

function SafetyBoundary() {
  return (
    <section className="rounded-3xl border border-foreground/15 bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <h2 className="text-sm font-bold">Import controlat, fara publicare automata</h2>
          <p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">Pipeline-ul salveaza sursa ca snapshot imuabil, valideaza fiecare rand, genereaza dry-run si cere confirmare exacta inainte de executie. Nu publica profiluri, nu le marcheaza ca verificate, nu creeaza servicii sau specialisti si nu acorda acces furnizorilor.</p>
        </div>
      </div>
    </section>
  );
}

function UploadPanel({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [format, setFormat] = useState("");
  const [sha, setSha] = useState("");
  const [sourceName, setSourceName] = useState("Registru privat VIASEE");
  const [sourceVersion, setSourceVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");

  const columns = useMemo(() => sourceColumns(rows), [rows]);

  const selectFile = async (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected);
    setRows([]);
    setSha("");
    setError("");
    if (!selected) return;
    const detected = detectDirectorySourceFormat(selected.name);
    if (!detected) {
      setError("Format acceptat: .md, .csv, .json, .jsonl sau .ndjson.");
      return;
    }
    try {
      const text = await selected.text();
      const parsed = parseDirectorySource(text, detected);
      if (!parsed.length) throw new Error("Nu au fost gasite randuri de locatie in fisier.");
      setFormat(detected);
      setRows(parsed);
      setSha(await sha256Hex(text));
      if (!sourceVersion) setSourceVersion(selected.name.replace(/\.[^.]+$/, ""));
    } catch (parseError) {
      setError(parseError.message || "Fisierul nu a putut fi citit.");
    }
  };

  const upload = async () => {
    if (!file || !rows.length || !sha || !sourceVersion.trim()) return;
    setLoading(true);
    setError("");
    setProgress({ current: 0, total: rows.length });
    const created = await invoke({
      action: "create_snapshot",
      source_name: sourceName,
      source_version: sourceVersion,
      source_sha256: sha,
      source_format: format,
      original_filename: file.name,
      total_rows: rows.length,
      notes,
      column_map: Object.fromEntries(columns.map((column) => [column, column])),
    });
    if (created.error) {
      setError(created.error);
      setLoading(false);
      return;
    }
    const snapshot = created.snapshot;
    if (!created.reused || !snapshot.immutable_at) {
      for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
        const chunk = rows.slice(start, start + CHUNK_SIZE);
        const appended = await invoke({ action: "append_rows", snapshot_id: snapshot.id, start_row_number: start + 1, rows: chunk });
        if (appended.error) {
          setError(`Incarcarea s-a oprit la randul ${start + 1}: ${appended.error}`);
          setLoading(false);
          return;
        }
        setProgress({ current: Math.min(rows.length, start + chunk.length), total: rows.length });
      }
      const finalized = await invoke({ action: "finalize_snapshot", snapshot_id: snapshot.id, require_siruta: true });
      if (finalized.error) {
        setError(finalized.error);
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    onUploaded(snapshot.id);
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3"><UploadCloud className="mt-0.5 h-5 w-5" /><div><h2 className="text-sm font-bold">1. Incarca snapshotul sursa</h2><p className="mt-1 text-xs text-muted-foreground">Fisierul este analizat local, apoi randurile sunt trimise in loturi de maximum {CHUNK_SIZE}.</p></div></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="block rounded-2xl border border-dashed border-border bg-background p-4">
          <span className="text-xs font-semibold">Fisier registru</span>
          <input type="file" accept=".md,.markdown,.csv,.json,.jsonl,.ndjson" onChange={selectFile} className="mt-2 block w-full text-xs" />
          {file && <div className="mt-3 text-xs text-muted-foreground"><strong className="text-foreground">{file.name}</strong> · {rows.length} randuri · {format}</div>}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold">Nume sursa<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>
          <label className="text-xs font-semibold">Versiune sursa<input value={sourceVersion} onChange={(event) => setSourceVersion(event.target.value)} placeholder="ex. V3-2026-07-21" className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>
          <label className="text-xs font-semibold sm:col-span-2">Nota interna<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label>
        </div>
      </div>
      {columns.length > 0 && <div className="mt-4 rounded-2xl bg-secondary/35 p-3 text-xs"><strong>Coloane detectate:</strong> <span className="text-muted-foreground">{columns.join(", ")}</span></div>}
      {sha && <div className="mt-3 break-all font-mono text-[10px] text-muted-foreground">SHA-256: {sha}</div>}
      {loading && <div className="mt-4"><ProgressBar value={progress.current} total={progress.total} /></div>}
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
      <button type="button" onClick={upload} disabled={loading || !file || !rows.length || !sourceVersion.trim()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Creeaza si valideaza snapshotul
      </button>
    </section>
  );
}

function SnapshotList({ snapshots, selectedId, onSelect, onRefresh, loading }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-bold">Snapshoturi</h2><p className="mt-1 text-xs text-muted-foreground">Sursele finalizate sunt imuabile.</p></div><button type="button" onClick={onRefresh} disabled={loading} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-secondary"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      <div className="mt-4 space-y-2">
        {snapshots.length === 0 && <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Nu exista snapshoturi.</div>}
        {snapshots.map((snapshot) => (
          <button key={snapshot.id} type="button" onClick={() => onSelect(snapshot.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === snapshot.id ? "border-foreground/35 bg-secondary/45" : "border-border bg-background hover:bg-secondary/20"}`}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold">{snapshot.source_version}</div><div className="mt-1 truncate text-[11px] text-muted-foreground">{snapshot.original_filename || snapshot.source_name}</div></div><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${statusTone(snapshot.status)}`}>{STATUS_LABELS[snapshot.status] || snapshot.status}</span></div>
            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]"><span className="rounded-lg bg-secondary/50 px-1 py-1.5">{snapshot.total_rows || 0} total</span><span className="rounded-lg bg-green-50 px-1 py-1.5 text-green-800">{snapshot.valid_rows || 0} valide</span><span className="rounded-lg bg-red-50 px-1 py-1.5 text-red-800">{snapshot.blocked_rows || 0} blocate</span></div>
          </button>
        ))}
      </div>
    </section>
  );
}

function RowOverride({ row, onClose, onSaved }) {
  const normalized = parseJson(row.normalized_payload_json, {});
  const previous = parseJson(row.admin_override_json, {});
  const [values, setValues] = useState(() => Object.fromEntries(OVERRIDE_FIELDS.map(([key]) => [key, previous[key] ?? normalized[key] ?? ""])));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setSaving(true);
    const result = await invoke({ action: "override_row", row_id: row.id, override: values, note });
    setSaving(false);
    if (result.error) { setError(result.error); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 shadow-2xl sm:max-w-3xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Corectie administrativa</div><h3 className="mt-1 text-base font-bold">Randul {row.row_number}</h3></div><button type="button" onClick={onClose} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold">Inchide</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {OVERRIDE_FIELDS.map(([key, label]) => <label key={key} className="text-xs font-semibold">{label}<input value={values[key] || ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>)}
          <label className="text-xs font-semibold sm:col-span-2">Motivul corectiei<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label>
        </div>
        {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
        <button type="button" onClick={save} disabled={saving || !note.trim()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salveaza corectia</button>
      </section>
    </div>
  );
}

function RowTable({ rows, onEdit }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const normalized = parseJson(row.normalized_payload_json, {});
        const errors = parseJson(row.validation_errors_json, []);
        return (
          <article key={row.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">#{row.row_number}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(row.status)}`}>{row.status}</span>{row.planned_action && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">{row.planned_action}</span>}</div><h4 className="mt-2 truncate text-sm font-bold">{normalized.location_name || "Rand fara nume"}</h4><p className="mt-1 text-xs text-muted-foreground">{[normalized.organization_name, normalized.locality_name, normalized.address].filter(Boolean).join(" · ") || "Date insuficiente"}</p>{errors.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{errors.map((code) => <span key={code} className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-800">{code}</span>)}</div>}</div>
              <button type="button" onClick={() => onEdit(row)} className="min-h-9 rounded-full border border-border px-3 text-xs font-semibold hover:bg-secondary">Corecteaza</button>
            </div>
          </article>
        );
      })}
      {rows.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nu exista randuri pentru filtrul curent.</div>}
    </div>
  );
}

function BatchPanel({ batch, onReload }) {
  const stopRef = useRef(false);
  const summary = parseJson(batch?.summary_json, {});
  const [confirmation, setConfirmation] = useState("");
  const [rollbackConfirmation, setRollbackConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setConfirmation(""); setRollbackConfirmation(""); stopRef.current = false; setRunning(false); }, [batch?.id]);
  if (!batch) return null;
  const approvalPhrase = summary.approval_token || `IMPORT ${batch.batch_key} ${String(batch.source_sha256 || "").slice(0, 12)} ${batch.ready_rows || 0}`;
  const rollbackPhrase = `ROLLBACK ${batch.batch_key} ${batch.applied_rows || 0}`;

  const approve = async () => {
    setLoading(true); setError("");
    const result = await invoke({ action: "approve_batch", batch_id: batch.id, confirmation });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setMessage("Lotul a fost aprobat pentru executie."); onReload();
  };

  const run = async (continuous) => {
    setRunning(true); setError(""); setMessage(""); stopRef.current = false;
    let lockToken = "";
    do {
      const result = await invoke({ action: "execute_batch", batch_id: batch.id, lock_token: lockToken, limit: 20 });
      if (result.error) { setError(result.error); break; }
      lockToken = result.lock_token || "";
      setMessage(`Procesate ${result.processed} randuri: ${result.applied} aplicate, ${result.failed} esuate.`);
      await onReload(false);
      if (!continuous || !result.remaining || stopRef.current) break;
    } while (true);
    setRunning(false); await onReload();
  };

  const rollback = async (continuous) => {
    setRunning(true); setError(""); setMessage(""); stopRef.current = false;
    let lockToken = "";
    do {
      const result = await invoke({ action: "rollback_batch", batch_id: batch.id, confirmation: rollbackConfirmation, lock_token: lockToken, limit: 40 });
      if (result.error) { setError(result.error); break; }
      lockToken = result.lock_token || "";
      setMessage(`Rollback: ${result.completed} operatii inversate, ${result.failed} blocate.`);
      await onReload(false);
      if (!continuous || !result.remaining || stopRef.current) break;
    } while (true);
    setRunning(false); await onReload();
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lot {batch.batch_key}</div><h3 className="mt-1 text-base font-bold">Dry-run si executie</h3></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(batch.status)}`}>{STATUS_LABELS[batch.status] || batch.status}</span></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Pregatite" value={batch.ready_rows} /><Stat label="Blocate" value={batch.blocked_rows} /><Stat label="Aplicate" value={batch.applied_rows} /><Stat label="Esuate" value={batch.failed_rows} /></div>
      {summary.action_counts && <div className="mt-4 rounded-2xl bg-secondary/35 p-3 text-[11px] leading-5 text-muted-foreground">{Object.entries(summary.action_counts).filter(([, value]) => value > 0).map(([key, value]) => <span key={key} className="mr-3 inline-block"><strong className="text-foreground">{value}</strong> {key}</span>)}</div>}

      {batch.status === "ready" && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-bold text-amber-950">Confirmare pentru import</div><p className="mt-1 text-xs text-amber-900">Copiaza exact fraza de mai jos. Randurile blocate nu vor fi executate.</p><code className="mt-3 block overflow-x-auto rounded-xl bg-white/70 p-3 text-[11px] text-amber-950">{approvalPhrase}</code><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm" /><button type="button" onClick={approve} disabled={loading || confirmation !== approvalPhrase} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-40 sm:w-auto">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Aproba lotul</button></div>}

      {["approved", "running"].includes(batch.status) && <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => run(false)} disabled={running} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-secondary disabled:opacity-40"><Play className="h-4 w-4" /> Executa urmatoarele 20</button><button type="button" onClick={() => run(true)} disabled={running} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Executa pana la final</button>{running && <button type="button" onClick={() => { stopRef.current = true; }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 px-5 text-sm font-semibold text-red-700"><Square className="h-4 w-4" /> Opreste dupa lot</button>}</div>}

      {["completed", "completed_with_errors", "rollback_failed", "rolling_back"].includes(batch.status) && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="text-xs font-bold text-red-950">Rollback controlat</div><p className="mt-1 text-xs text-red-900">Rollbackul este blocat daca o entitate a fost modificata, revendicata sau a primit servicii/acces dupa import.</p><code className="mt-3 block overflow-x-auto rounded-xl bg-white/70 p-3 text-[11px] text-red-950">{rollbackPhrase}</code><input value={rollbackConfirmation} onChange={(event) => setRollbackConfirmation(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-red-300 bg-white px-3 text-sm" /><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => rollback(false)} disabled={running || rollbackConfirmation !== rollbackPhrase} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-300 px-5 text-xs font-semibold text-red-800 disabled:opacity-40"><RotateCcw className="h-4 w-4" /> Retrage urmatorul lot</button><button type="button" onClick={() => rollback(true)} disabled={running || rollbackConfirmation !== rollbackPhrase} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-red-700 px-5 text-xs font-semibold text-white disabled:opacity-40">{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Rollback pana la final</button></div></div>}
      {message && <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">{message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
    </section>
  );
}

function SnapshotWorkspace({ snapshotId, onRefreshSnapshots }) {
  const [detail, setDetail] = useState(null);
  const [rowStatus, setRowStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [editingRow, setEditingRow] = useState(null);

  const load = useCallback(async (showLoading = true) => {
    if (!snapshotId) return;
    if (showLoading) setLoading(true);
    const result = await invoke({ action: "get_snapshot", snapshot_id: snapshotId, status: rowStatus, limit: 200 });
    if (showLoading) setLoading(false);
    if (result.error) { setError(result.error); setDetail(null); return; }
    setDetail(result); setError("");
  }, [snapshotId, rowStatus]);

  useEffect(() => { load(); }, [load]);

  const createPlan = async () => {
    setPlanning(true); setError("");
    const result = await invoke({ action: "plan_batch", snapshot_id: snapshotId });
    setPlanning(false);
    if (result.error) { setError(result.error); return; }
    await load(); await onRefreshSnapshots();
  };

  if (loading) return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca snapshotul...</div>;
  if (!detail) return <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error || "Snapshot indisponibil."}</div>;
  const { snapshot, rows, batches } = detail;
  const latestBatch = batches?.[0] || null;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Snapshot imuabil</div><h2 className="mt-1 text-lg font-extrabold">{snapshot.source_version}</h2><p className="mt-1 text-xs text-muted-foreground">{snapshot.original_filename} · finalizat {formatDate(snapshot.finalized_at)}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(snapshot.status)}`}>{STATUS_LABELS[snapshot.status] || snapshot.status}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Stat label="Total" value={snapshot.total_rows} /><Stat label="Valide" value={snapshot.valid_rows} /><Stat label="Blocate" value={snapshot.blocked_rows} /><Stat label="Duplicate" value={snapshot.duplicate_rows} /><Stat label="Avertismente" value={snapshot.warning_rows} /></div>
        <div className="mt-4 break-all rounded-2xl bg-secondary/35 p-3 font-mono text-[10px] text-muted-foreground">{snapshot.source_sha256}</div>
        {!latestBatch && ["ready", "blocked"].includes(snapshot.status) && <button type="button" onClick={createPlan} disabled={planning || !snapshot.valid_rows} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">{planning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Genereaza dry-run</button>}
      </section>

      {latestBatch && <BatchPanel batch={latestBatch} onReload={async (showLoading = true) => { await load(showLoading); await onRefreshSnapshots(); }} />}

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-sm font-bold">Randurile snapshotului</h3><p className="mt-1 text-xs text-muted-foreground">Corectiile administrative se salveaza separat de sursa originala.</p></div><div className="flex items-center gap-2"><select value={rowStatus} onChange={(event) => setRowStatus(event.target.value)} className="min-h-10 rounded-xl border border-border bg-background px-3 text-xs">{ROW_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button type="button" onClick={() => load()} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-secondary"><RefreshCw className="h-4 w-4" /></button></div></div>
        <div className="mt-4"><RowTable rows={rows || []} onEdit={setEditingRow} /></div>
      </section>
      {editingRow && <RowOverride row={editingRow} onClose={() => setEditingRow(null)} onSaved={async () => { setEditingRow(null); await load(); }} />}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
    </div>
  );
}

export default function DirOpsImportPipeline() {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState("");

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    const result = await invoke({ action: "list_snapshots", limit: 100 });
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setSnapshots(result.snapshots || []);
    if (!selectedId && result.snapshots?.[0]) setSelectedId(result.snapshots[0].id);
  }, [selectedId]);

  useEffect(() => { loadSnapshots(); }, []);

  const visibleSnapshots = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return snapshots;
    return snapshots.filter((snapshot) => [snapshot.source_version, snapshot.original_filename, snapshot.source_name, snapshot.status].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [query, snapshots]);

  const uploaded = async (snapshotId) => {
    setUploadOpen(false); await loadSnapshots(); setSelectedId(snapshotId);
  };

  return (
    <div className="space-y-5">
      <SafetyBoundary />
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta snapshot..." className="min-h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm" /></div><button type="button" onClick={() => setUploadOpen((value) => !value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"><FileUp className="h-4 w-4" /> Snapshot nou <ChevronDown className={`h-4 w-4 transition ${uploadOpen ? "rotate-180" : ""}`} /></button></div>
      {uploadOpen && <UploadPanel onUploaded={uploaded} />}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SnapshotList snapshots={visibleSnapshots} selectedId={selectedId} onSelect={setSelectedId} onRefresh={loadSnapshots} loading={loading} />
        <div>{selectedId ? <SnapshotWorkspace snapshotId={selectedId} onRefreshSnapshots={loadSnapshots} /> : <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground"><Database className="mx-auto mb-3 h-6 w-6" />Selecteaza sau incarca un snapshot.</div>}</div>
      </div>
    </div>
  );
}
