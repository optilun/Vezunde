import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  detectDirectorySourceFormat,
  parseDirectorySource,
  sha256Hex,
  sourceColumns,
} from "@/lib/directoryImportFileParser";

const CHUNK_SIZE = 50;
const EXECUTION_CHUNK_SIZE = 5;
const EXECUTION_PAUSE_MS = 2500;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const LABELS = {
  draft: "Draft", uploading: "Se incarca", validating: "Se valideaza", ready: "Pregatit",
  blocked: "Blocat", imported: "Importat", archived: "Arhivat", planning: "Dry-run in lucru",
  approved: "Aprobat", running: "Import in lucru", completed: "Finalizat",
  completed_with_errors: "Finalizat cu erori", failed: "Esuat", rolling_back: "Rollback in lucru",
  rolled_back: "Retras", rollback_failed: "Rollback incomplet",
};
const ROW_FILTERS = [
  ["", "Toate randurile"], ["blocked", "Blocate"], ["ready", "Pregatite"],
  ["failed", "Esuate"], ["applied", "Aplicate"], ["skipped", "Sarite"],
];
const EDIT_FIELDS = [
  ["location_name", "Nume locatie"], ["organization_name", "Organizatie"],
  ["target_organization_id", "ID organizatie existenta (mapare explicita)"],
  ["locality_name", "Localitate"], ["county_name", "Judet"],
  ["locality_siruta_code", "Cod SIRUTA"], ["address", "Adresa"],
  ["provider_type", "Provider type"], ["provider_profile_type", "Profile type"],
  ["location_type_code", "Tip canonic locatie"], ["care_setting_code", "Mediu"],
  ["source_url", "Sursa oficiala"],
];

function json(value, fallback = {}) { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function call(payload) {
  return base44.functions.invoke("directoryImportOps", payload)
    .then((response) => response.data)
    .catch((error) => ({ error: error.response?.data?.error || error.message || "Operatia a esuat." }));
}
async function finishSnapshotValidation(snapshotId) {
  let remaining = true;
  let calls = 0;
  while (remaining && calls < 100) {
    const result = await call({
      action: "finalize_snapshot",
      snapshot_id: snapshotId,
      require_siruta: true,
      limit: CHUNK_SIZE,
    });
    if (result.error) return { error: result.error };
    remaining = result.remaining === true;
    calls += 1;
    if (remaining && Number(result.processed || 0) < 1) {
      return { error: "Validarea s-a oprit fara progres. Reincarca starea inainte sa continui." };
    }
  }
  if (remaining) {
    return { error: "Validarea nu s-a putut finaliza in limita de siguranta." };
  }
  return { success: true };
}
function tone(status) {
  if (["ready", "completed", "imported", "rolled_back", "applied"].includes(status)) return "border-green-200 bg-green-50 text-green-900";
  if (["blocked", "failed", "rollback_failed", "completed_with_errors"].includes(status)) return "border-red-200 bg-red-50 text-red-900";
  if (["uploading", "validating", "planning", "approved", "running", "rolling_back"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-border bg-secondary/40 text-foreground";
}
function Badge({ status }) { return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${tone(status)}`}>{LABELS[status] || status}</span>; }
function Stat({ label, value }) { return <div className="rounded-2xl border border-border bg-background p-3"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-xl font-extrabold">{value || 0}</div></div>; }
function Progress({ value, total }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return <div><div className="mb-1 flex justify-between text-[11px] text-muted-foreground"><span>{value} din {total}</span><span>{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-foreground" style={{ width: `${percent}%` }} /></div></div>;
}

function UploadPanel({ onDone }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [format, setFormat] = useState("");
  const [sha, setSha] = useState("");
  const [sourceName, setSourceName] = useState("Registru privat VIASEE");
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState({ value: 0, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const columns = useMemo(() => sourceColumns(rows), [rows]);

  const select = async (event) => {
    const selected = event.target.files?.[0] || null;
    setFile(selected); setRows([]); setSha(""); setError("");
    if (!selected) return;
    try {
      const detected = detectDirectorySourceFormat(selected.name);
      if (!detected) throw new Error("Format acceptat: MD, CSV, JSON sau NDJSON.");
      const text = await selected.text();
      const parsed = parseDirectorySource(text, detected);
      if (!parsed.length) throw new Error("Nu au fost gasite randuri de locatie.");
      setRows(parsed); setFormat(detected); setSha(await sha256Hex(text));
      setVersion((current) => current || selected.name.replace(/\.[^.]+$/, ""));
    } catch (reason) { setError(reason.message || "Fisierul nu a putut fi citit."); }
  };

  const upload = async () => {
    setBusy(true); setError(""); setProgress({ value: 0, total: rows.length });
    const created = await call({
      action: "create_snapshot", source_name: sourceName, source_version: version,
      source_sha256: sha, source_format: format, original_filename: file.name,
      total_rows: rows.length, notes, column_map: Object.fromEntries(columns.map((key) => [key, key])),
    });
    if (created.error) { setError(created.error); setBusy(false); return; }
    const snapshot = created.snapshot;
    if (!created.reused || !snapshot.immutable_at) {
      if (!["draft", "uploading", "validating"].includes(snapshot.status)) {
        setError("Snapshotul existent nu poate fi reluat din starea curenta.");
        setBusy(false);
        return;
      }
      if (snapshot.status !== "validating") {
        for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
          const chunk = rows.slice(start, start + CHUNK_SIZE);
          const result = await call({ action: "append_rows", snapshot_id: snapshot.id, start_row_number: start + 1, rows: chunk });
          if (result.error) { setError(`Rand ${start + 1}: ${result.error}`); setBusy(false); return; }
          setProgress({ value: Math.min(rows.length, start + chunk.length), total: rows.length });
        }
      } else {
        setProgress({ value: rows.length, total: rows.length });
      }
      const finalized = await finishSnapshotValidation(snapshot.id);
      if (finalized.error) {
        setError(finalized.error);
        setBusy(false);
        return;
      }
    }
    setBusy(false); onDone(snapshot.id);
  };

  return <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
    <div className="flex items-start gap-3"><UploadCloud className="mt-0.5 h-5 w-5" /><div><h2 className="text-sm font-bold">1. Incarca snapshotul sursa</h2><p className="mt-1 text-xs text-muted-foreground">Fisierul este analizat local si incarcat in loturi de {CHUNK_SIZE}.</p></div></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <label className="rounded-2xl border border-dashed border-border bg-background p-4 text-xs font-semibold">Fisier registru<input type="file" accept=".md,.markdown,.csv,.json,.jsonl,.ndjson" onChange={select} className="mt-2 block w-full text-xs" />{file && <span className="mt-3 block font-normal text-muted-foreground">{file.name} · {rows.length} randuri · {format}</span>}</label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Nume sursa<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="text-xs font-semibold">Versiune<input value={version} onChange={(event) => setVersion(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label><label className="text-xs font-semibold sm:col-span-2">Nota<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label></div>
    </div>
    {columns.length > 0 && <div className="mt-4 rounded-2xl bg-secondary/35 p-3 text-xs"><strong>Coloane:</strong> <span className="text-muted-foreground">{columns.join(", ")}</span></div>}
    {sha && <div className="mt-3 break-all font-mono text-[10px] text-muted-foreground">SHA-256: {sha}</div>}
    {busy && <div className="mt-4"><Progress value={progress.value} total={progress.total} /></div>}
    {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
    <button type="button" onClick={upload} disabled={busy || !file || !rows.length || !version.trim()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Creeaza si valideaza</button>
  </section>;
}

function EditRow({ row, onClose, onSaved }) {
  const normalized = json(row.normalized_payload_json, {});
  const previous = json(row.admin_override_json, {});
  const [values, setValues] = useState(() => Object.fromEntries(EDIT_FIELDS.map(([key]) => [key, previous[key] ?? normalized[key] ?? ""])));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); const result = await call({ action: "override_row", row_id: row.id, override: values, note }); setBusy(false);
    if (result.error) { setError(result.error); return; } onSaved();
  };
  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 sm:items-center sm:p-4" role="dialog" aria-modal="true"><section className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-card p-5 sm:max-w-3xl sm:rounded-3xl"><div className="flex justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase text-muted-foreground">Corectie administrativa</div><h3 className="mt-1 font-bold">Randul {row.row_number}</h3></div><button type="button" onClick={onClose} className="rounded-full border border-border px-3 text-xs font-semibold">Inchide</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{EDIT_FIELDS.map(([key, label]) => <label key={key} className="text-xs font-semibold">{label}<input value={values[key]} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" /></label>)}<label className="text-xs font-semibold sm:col-span-2">Motiv<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" /></label></div>{error && <p className="mt-3 text-xs text-red-700">{error}</p>}<button type="button" onClick={save} disabled={busy || !note.trim()} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salveaza</button></section></div>;
}

function Rows({ rows, onEdit }) {
  return <div className="space-y-2">{rows.map((row) => {
    const data = json(row.normalized_payload_json, {}); const errors = json(row.validation_errors_json, []);
    return <article key={row.id} className="rounded-2xl border border-border bg-background p-3"><div className="flex flex-col gap-3 lg:flex-row lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-muted-foreground">#{row.row_number}</span><Badge status={row.status} />{row.planned_action && <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold">{row.planned_action}</span>}</div><h4 className="mt-2 truncate text-sm font-bold">{data.location_name || "Rand fara nume"}</h4><p className="mt-1 text-xs text-muted-foreground">{[data.organization_name, data.locality_name, data.address].filter(Boolean).join(" · ") || "Date insuficiente"}</p>{errors.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{errors.map((code) => <span key={code} className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-800">{code}</span>)}</div>}</div><button type="button" onClick={() => onEdit(row)} className="min-h-9 rounded-full border border-border px-3 text-xs font-semibold hover:bg-secondary">Corecteaza</button></div></article>;
  })}{rows.length === 0 && <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nu exista randuri.</div>}</div>;
}

function Batch({ batch, reload, continuePlanning }) {
  const stop = useRef(false);
  const summary = json(batch.summary_json, {});
  const approvalPhrase = summary.approval_token || `IMPORT ${batch.batch_key} ${String(batch.source_sha256 || "").slice(0, 12)} ${batch.ready_rows || 0}`;
  const rollbackPhrase = `ROLLBACK ${batch.batch_key} ${batch.applied_rows || 0}`;
  const [confirmation, setConfirmation] = useState("");
  const [rollbackText, setRollbackText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const retryableDryRunFailure = batch.status === "failed"
    && batch.mode === "dry_run"
    && Number(batch.applied_rows || 0) === 0
    && !batch.approved_at
    && !batch.started_at;
  const hasExecutionInterruption = ["approved", "running"].includes(batch.status)
    && Boolean(batch.failure_message);

  const approve = async () => { setBusy(true); const result = await call({ action: "approve_batch", batch_id: batch.id, confirmation }); setBusy(false); if (result.error) setError(result.error); else { setMessage("Lot aprobat."); reload(); } };
  const recover = async () => {
    setBusy(true); setError(""); setMessage("");
    let remaining = true; let recovered = 0; let calls = 0; let failed = false;
    while (remaining && calls < 100) {
      const result = await call({ action: "resume_batch", batch_id: batch.id, limit: EXECUTION_CHUNK_SIZE });
      if (result.error) { setError(result.error); failed = true; break; }
      recovered += Number(result.recovered || 0);
      remaining = result.remaining === true;
      calls += 1;
      await reload(false);
      if (remaining) await pause(EXECUTION_PAUSE_MS);
    }
    if (!failed && !remaining) setMessage(`Reluarea este pregatita. ${recovered} randuri temporar esuate au fost repuse in asteptare.`);
    else if (!failed) setError("Reluarea nu s-a finalizat in limita de siguranta.");
    setBusy(false); await reload();
  };
  const process = async (action, continuous) => {
    setBusy(true); setError(""); stop.current = false; let lockToken = "";
    do {
      const result = await call({ action, batch_id: batch.id, confirmation: action === "rollback_batch" ? rollbackText : undefined, lock_token: lockToken, limit: action === "execute_batch" ? EXECUTION_CHUNK_SIZE : 40 });
      if (result.error) { setError(result.error); break; }
      lockToken = result.lock_token || ""; setMessage(action === "execute_batch" ? `Procesate ${result.processed}: ${result.applied} aplicate, ${result.failed} esuate.` : `Rollback: ${result.completed} inversate, ${result.failed} blocate.`);
      await reload(false); if (!continuous || !result.remaining || stop.current) break;
      await pause(EXECUTION_PAUSE_MS);
    } while (true);
    setBusy(false); await reload();
  };

  return <section className="rounded-3xl border border-border bg-card p-5 shadow-sm"><div className="flex justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase text-muted-foreground">Lot {batch.batch_key}</div><h3 className="mt-1 font-bold">Dry-run si executie</h3></div><Badge status={batch.status} /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Pregatite" value={batch.ready_rows} /><Stat label="Blocate" value={batch.blocked_rows} /><Stat label="Aplicate" value={batch.applied_rows} /><Stat label="Esuate" value={batch.failed_rows} /></div>
    {batch.status === "planning" && <button type="button" onClick={continuePlanning} disabled={busy} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Continua dry-run</button>}
    {batch.status === "failed" && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="text-xs font-bold text-red-950">Dry-run invalidat</div><p className="mt-1 text-xs text-red-900">{batch.failure_message || "Lotul nu mai poate fi folosit."}</p>{retryableDryRunFailure && <button type="button" onClick={continuePlanning} disabled={busy} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Genereaza dry-run nou</button>}</div>}
    {batch.status === "ready" && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-bold text-amber-950">Confirmare pentru import</div><code className="mt-3 block overflow-x-auto rounded-xl bg-white/70 p-3 text-[11px]">{approvalPhrase}</code><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-amber-300 bg-white px-3 text-sm" /><button type="button" onClick={approve} disabled={busy || confirmation !== approvalPhrase} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-40"><ShieldCheck className="h-4 w-4" /> Aproba lotul</button></div>}
    {hasExecutionInterruption && <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4"><div className="text-xs font-bold text-amber-950">Import intrerupt temporar</div><p className="mt-1 text-xs text-amber-900">{batch.failure_message}</p><p className="mt-2 text-xs text-amber-900">Randurile deja aplicate raman intacte. Reconciliem progresul si repunem numai randurile afectate in asteptare.</p><button type="button" onClick={recover} disabled={busy} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Pregateste reluarea</button></div>}
    {["approved", "running"].includes(batch.status) && !hasExecutionInterruption && <div className="mt-5 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => process("execute_batch", false)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold"><Play className="h-4 w-4" /> Urmatoarele 5</button><button type="button" onClick={() => process("execute_batch", true)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Pana la final, cu pauze</button>{busy && <button type="button" onClick={() => { stop.current = true; }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 px-5 text-sm font-semibold text-red-700"><Square className="h-4 w-4" /> Opreste dupa lot</button>}</div>}
    {["completed", "completed_with_errors", "rollback_failed", "rolling_back"].includes(batch.status) && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4"><div className="text-xs font-bold text-red-950">Rollback controlat</div><p className="mt-1 text-xs text-red-900">Se blocheaza daca datele au fost modificate sau revendicate dupa import.</p><code className="mt-3 block overflow-x-auto rounded-xl bg-white/70 p-3 text-[11px]">{rollbackPhrase}</code><input value={rollbackText} onChange={(event) => setRollbackText(event.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-red-300 bg-white px-3 text-sm" /><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => process("rollback_batch", false)} disabled={busy || rollbackText !== rollbackPhrase} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-red-300 px-5 text-xs font-semibold text-red-800 disabled:opacity-40"><RotateCcw className="h-4 w-4" /> Urmatorul lot</button><button type="button" onClick={() => process("rollback_batch", true)} disabled={busy || rollbackText !== rollbackPhrase} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-red-700 px-5 text-xs font-semibold text-white disabled:opacity-40"><Archive className="h-4 w-4" /> Pana la final</button></div></div>}
    {message && <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-3 text-xs text-green-900">{message}</div>}{error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}
  </section>;
}

function Workspace({ snapshotId, refreshList }) {
  const [detail, setDetail] = useState(null); const [filter, setFilter] = useState(""); const [busy, setBusy] = useState(true); const [error, setError] = useState(""); const [edit, setEdit] = useState(null);
  const load = useCallback(async (showBusy = true) => { if (showBusy) setBusy(true); const result = await call({ action: "get_snapshot", snapshot_id: snapshotId, status: filter, limit: 200 }); if (showBusy) setBusy(false); if (result.error) { setError(result.error); setDetail(null); } else { setDetail(result); setError(""); } }, [filter, snapshotId]);
  useEffect(() => { load(); }, [load]);
  const finalize = async () => {
    setBusy(true); setError("");
    const result = await finishSnapshotValidation(snapshotId);
    setBusy(false);
    if (result.error) setError(result.error);
    else { await load(); await refreshList(); }
  };
  const plan = async () => {
    setBusy(true); setError(""); let remaining = true; let calls = 0;
    while (remaining && calls < 100) {
      const result = await call({ action: "plan_batch", snapshot_id: snapshotId, limit: CHUNK_SIZE });
      if (result.error) { setError(result.error); setBusy(false); return; }
      remaining = result.remaining === true;
      calls += 1;
      if (remaining && Number(result.processed || 0) < 1) {
        setError("Dry-run-ul s-a oprit fara progres. Reincarca starea inainte sa continui.");
        setBusy(false);
        return;
      }
      if (remaining) await load(false);
    }
    setBusy(false);
    if (remaining) setError("Dry-run-ul nu s-a putut finaliza in limita de siguranta.");
    else { await load(); await refreshList(); }
  };
  if (busy && !detail) return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca...</div>;
  if (!detail) return <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;
  const snapshot = detail.snapshot; const batch = detail.batches?.[0] || null;
  return <div className="space-y-5"><section className="rounded-3xl border border-border bg-card p-5 shadow-sm"><div className="flex justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase text-muted-foreground">Snapshot imuabil</div><h2 className="mt-1 text-lg font-extrabold">{snapshot.source_version}</h2><p className="mt-1 text-xs text-muted-foreground">{snapshot.original_filename}</p></div><Badge status={snapshot.status} /></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><Stat label="Total" value={snapshot.total_rows} /><Stat label="Valide" value={snapshot.valid_rows} /><Stat label="Blocate" value={snapshot.blocked_rows} /><Stat label="Duplicate" value={snapshot.duplicate_rows} /><Stat label="Avertismente" value={snapshot.warning_rows} /></div><div className="mt-4 break-all rounded-2xl bg-secondary/35 p-3 font-mono text-[10px] text-muted-foreground">{snapshot.source_sha256}</div>{snapshot.status === "validating" && <button type="button" onClick={finalize} disabled={busy} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-border px-5 text-sm font-semibold disabled:opacity-40 sm:w-auto">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} Continua validarea</button>}{!batch && ["ready", "blocked"].includes(snapshot.status) && <button type="button" onClick={plan} disabled={busy || !snapshot.valid_rows} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto"><FileCheck2 className="h-4 w-4" /> Genereaza dry-run</button>}</section>{batch && <Batch batch={batch} continuePlanning={plan} reload={async (showBusy = true) => { await load(showBusy); await refreshList(); }} />}<section className="rounded-3xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="text-sm font-bold">Randurile snapshotului</h3><p className="mt-1 text-xs text-muted-foreground">Corectiile nu modifica sursa originala.</p></div><div className="flex gap-2"><select value={filter} onChange={(event) => setFilter(event.target.value)} className="min-h-10 rounded-xl border border-border bg-background px-3 text-xs">{ROW_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="button" onClick={() => load()} className="h-10 w-10 rounded-xl border border-border"><RefreshCw className="mx-auto h-4 w-4" /></button></div></div><div className="mt-4"><Rows rows={detail.rows || []} onEdit={setEdit} /></div></section>{edit && <EditRow row={edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await load(); }} />}</div>;
}

export default function DirOpsImportPipeline() {
  const [snapshots, setSnapshots] = useState([]); const [selected, setSelected] = useState(""); const [query, setQuery] = useState(""); const [uploadOpen, setUploadOpen] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); const result = await call({ action: "list_snapshots", limit: 100 }); setLoading(false); if (result.error) { setError(result.error); return; } setSnapshots(result.snapshots || []); setSelected((current) => current || result.snapshots?.[0]?.id || ""); }, []);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => { const term = query.trim().toLowerCase(); return term ? snapshots.filter((item) => [item.source_version, item.original_filename, item.status].some((value) => String(value || "").toLowerCase().includes(term))) : snapshots; }, [query, snapshots]);
  return <div className="space-y-5"><section className="rounded-3xl border border-foreground/15 bg-card p-5 shadow-sm"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-sm font-bold">Import controlat, fara publicare automata</h2><p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">Snapshot imuabil, validare pe rand, dry-run, confirmare exacta, executie idempotenta si rollback. Nu publica, nu verifica si nu acorda acces.</p></div></div></section><div className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta snapshot..." className="min-h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm" /></div><button type="button" onClick={() => setUploadOpen((value) => !value)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"><FileUp className="h-4 w-4" /> Snapshot nou <ChevronDown className={`h-4 w-4 ${uploadOpen ? "rotate-180" : ""}`} /></button></div>{uploadOpen && <UploadPanel onDone={async (id) => { setUploadOpen(false); await load(); setSelected(id); }} />}{error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}<div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]"><section className="rounded-3xl border border-border bg-card p-4 shadow-sm"><div className="flex justify-between"><div><h2 className="text-sm font-bold">Snapshoturi</h2><p className="mt-1 text-xs text-muted-foreground">Surse finalizate si imuabile.</p></div><button type="button" onClick={load} className="h-10 w-10 rounded-full border border-border"><RefreshCw className={`mx-auto h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div><div className="mt-4 space-y-2">{visible.map((item) => <button key={item.id} type="button" onClick={() => setSelected(item.id)} className={`w-full rounded-2xl border p-3 text-left ${selected === item.id ? "border-foreground/35 bg-secondary/45" : "border-border bg-background"}`}><div className="flex justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-bold">{item.source_version}</div><div className="mt-1 truncate text-[11px] text-muted-foreground">{item.original_filename}</div></div><Badge status={item.status} /></div><div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]"><span className="rounded-lg bg-secondary p-1">{item.total_rows || 0} total</span><span className="rounded-lg bg-green-50 p-1 text-green-800">{item.valid_rows || 0} valide</span><span className="rounded-lg bg-red-50 p-1 text-red-800">{item.blocked_rows || 0} blocate</span></div></button>)}{visible.length === 0 && <div className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Nu exista snapshoturi.</div>}</div></section><div>{selected ? <Workspace snapshotId={selected} refreshList={load} /> : <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground"><Database className="mx-auto mb-3 h-6 w-6" />Selecteaza un snapshot.</div>}</div></div></div>;
}
