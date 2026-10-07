import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  DatabaseZap,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import RepairIssuesList from "@/components/admin/system/RepairIssuesList";
import { useAdminConfirm } from "@/components/admin/ui/AdminConfirm";

const TYPE_LABELS = {
  organization_completeness: "Completitudine organizație",
  location_completeness: "Completitudine locație",
  organization_status: "Status organizație",
  location_publication_alignment: "Status publicare",
  identical_active_submissions: "Cereri duplicate",
};

const FIELD_LABELS = {
  profile_completeness: "Completitudine",
  status: "Status",
  profile_control_status: "Control profil",
  public_visibility_status: "Vizibilitate publica",
  verification_state: "Stare verificare",
  is_verified: "Verificat",
  subject: "Subiect",
  active_count: "Cereri active",
  statuses: "Statusuri existente",
  keeper_status: "Status păstrat",
  duplicates_withdrawn: "Duplicate închise",
};

const BATCH_OPTIONS = [25, 50, 100, 250];

function formatValue(key, value) {
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  if (value === null || value === undefined || value === "") return "Lipsește";
  if (key === "profile_completeness") return `${value}%`;
  return String(value);
}

function ValuesPanel({ title, values, proposed = false }) {
  const entries = Object.entries(values || {});
  return (
    <div className={`rounded-2xl border px-4 py-3 ${proposed ? "border-success-border bg-success-soft" : "border-border bg-secondary/30"}`}>
      <div className={`text-[11px] font-bold uppercase tracking-[0.12em] ${proposed ? "text-success" : "text-muted-foreground"}`}>{title}</div>
      <div className="mt-2 divide-y divide-border/60">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 py-2 text-xs">
            <span className="text-muted-foreground">{FIELD_LABELS[key] || key}</span>
            <strong className="max-w-[58%] break-words text-right">{formatValue(key, value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function RepairCard({ repair, expanded, busy, selected, onToggle, onApply, onSelect }) {
  return (
    <div className={`rounded-[22px] border bg-card p-4 shadow-sm sm:p-5 ${selected ? "border-foreground/50" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
            aria-label={`Selectează ${repair.title}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{TYPE_LABELS[repair.repair_type] || repair.repair_type}</span>
              <span className="text-[11px] text-muted-foreground">{repair.entity_type}</span>
            </div>
            <h3 className="mt-2 text-sm font-bold leading-snug">{repair.title}</h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{repair.detail}</p>
          </div>
        </div>
        <button type="button" onClick={onToggle} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
          {expanded ? "Ascunde" : "Previzualizează"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <ValuesPanel title="Valori actuale" values={repair.current_values} />
            <ValuesPanel title="După reparație" values={repair.proposed_values} proposed />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success-border bg-success-soft px-4 py-3">
            <div className="flex items-start gap-2 text-xs leading-relaxed text-success">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Reparația modifică numai câmpurile afișate. Serverul verifică din nou semnătura datelor înainte de aplicare.</span>
            </div>
            <button type="button" disabled={busy} onClick={onApply} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              Aplica doar aceasta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDataRepairs() {
  const confirm = useAdminConfirm();
  const [repairs, setRepairs] = useState(null);
  const [expandedId, setExpandedId] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [typeFilter, setTypeFilter] = useState("all");
  const [batchSize, setBatchSize] = useState(100);
  const [progress, setProgress] = useState(null);
  const [issues, setIssues] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("adminDataIntegrityOps", { action: "scan" });
      if (response.data?.error) throw new Error(response.data.error);
      const nextRepairs = response.data?.repairs || [];
      setRepairs(nextRepairs);
      setExpandedId((current) => nextRepairs.some((repair) => repair.id === current) ? current : "");
      setSelectedIds((current) => {
        const valid = new Set(nextRepairs.map((repair) => repair.id));
        return new Set([...current].filter((id) => valid.has(id)));
      });
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut genera reparațiile sigure.");
      setRepairs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const typeOptions = useMemo(() => {
    const counts = new Map();
    for (const repair of repairs || []) counts.set(repair.repair_type, (counts.get(repair.repair_type) || 0) + 1);
    return [...counts.entries()].sort((left, right) => (TYPE_LABELS[left[0]] || left[0]).localeCompare(TYPE_LABELS[right[0]] || right[0]));
  }, [repairs]);

  const filteredRepairs = useMemo(
    () => (repairs || []).filter((repair) => typeFilter === "all" || repair.repair_type === typeFilter),
    [repairs, typeFilter],
  );

  const selectedRepairs = useMemo(() => {
    const selected = selectedIds;
    return (repairs || []).filter((repair) => selected.has(repair.id));
  }, [repairs, selectedIds]);

  const applyRepair = async (repair) => {
    setBusyId(repair.id);
    setError("");
    setMessage("");
    try {
      const response = await base44.functions.invoke("adminDataIntegrityOps", {
        action: "apply",
        repair_id: repair.id,
        expected_signature: repair.expected_signature,
        confirm: true,
      });
      if (response.data?.error) throw new Error(response.data.error);
      setMessage("Reparația a fost aplicată și înregistrată în Istoric audit.");
      setExpandedId("");
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(repair.id);
        return next;
      });
      await load();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Reparația nu a putut fi aplicată.");
    } finally {
      setBusyId("");
    }
  };

  const applyBulk = async () => {
    if (selectedRepairs.length === 0 || bulkRunning) return;
    const confirmed = await confirm({
      title: `Aplici ${selectedRepairs.length} reparații?`,
      description: `Rulează automat, în loturi de cel mult ${batchSize}. Fiecare reparație e reverificată de server înainte de aplicare și apare în Istoric audit.`,
      confirmLabel: "Aplică reparațiile",
    });
    if (!confirmed) return;

    setBulkRunning(true);
    setError("");
    setMessage("");
    const snapshot = [...selectedRepairs];
    let applied = 0;
    let skipped = 0;
    let failed = 0;
    const titles = new Map(snapshot.map((repair) => [repair.id, repair.title]));
    const collected = [];
    setIssues([]);
    setProgress({ done: 0, total: snapshot.length, applied: 0, skipped: 0, failed: 0 });

    try {
      for (let offset = 0; offset < snapshot.length; offset += batchSize) {
        const chunk = snapshot.slice(offset, offset + batchSize);
        const response = await base44.functions.invoke("adminDataIntegrityOps", {
          action: "apply_batch",
          confirm: true,
          repairs: chunk.map((repair) => ({ id: repair.id, expected_signature: repair.expected_signature })),
        });
        if (response.data?.error) throw new Error(response.data.error);
        applied += response.data?.applied_count || 0;
        skipped += response.data?.skipped_count || 0;
        failed += response.data?.failed_count || 0;
        for (const item of response.data?.failed || []) {
          collected.push({ kind: "failed", id: item.id, title: titles.get(item.id), reason: item.error || "Aplicare eșuată" });
        }
        for (const item of response.data?.skipped || []) {
          collected.push({ kind: "skipped", id: item.id, title: titles.get(item.id), reason: item.reason || "Sărită" });
        }
        setIssues([...collected]);
        const done = Math.min(snapshot.length, offset + chunk.length);
        setProgress({ done, total: snapshot.length, applied, skipped, failed });
      }
      setMessage(`Lot finalizat: ${applied} aplicate, ${skipped} sărite deoarece nu mai erau necesare sau datele s-au schimbat, ${failed} eșuate.`);
      setSelectedIds(new Set());
      await load();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Rularea în lot s-a oprit cu o eroare.");
    } finally {
      setBulkRunning(false);
    }
  };

  const selectFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const repair of filteredRepairs) next.add(repair.id);
      return next;
    });
  };

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-heading text-base font-bold">Reparații controlate</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Reparațiile deterministe pot fi acum selectate și aplicate în lot. Fiecare rând este reverificat de server înainte de modificare și rămâne înregistrat în Istoric audit.
          </p>
        </div>
        <button type="button" onClick={load} disabled={loading || !!busyId || bulkRunning} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recalculeaza
        </button>
      </div>

      {repairs && repairs.length > 0 && (
        <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[220px] text-[11px] font-semibold text-muted-foreground">
              TIP REPARAȚIE
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground">
                <option value="all">Toate tipurile ({repairs.length})</option>
                {typeOptions.map(([type, count]) => <option key={type} value={type}>{TYPE_LABELS[type] || type} ({count})</option>)}
              </select>
            </label>
            <label className="w-[150px] text-[11px] font-semibold text-muted-foreground">
              MĂRIME LOT
              <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground">
                {BATCH_OPTIONS.map((size) => <option key={size} value={size}>{size} reparatii</option>)}
              </select>
            </label>
            <button type="button" onClick={selectFiltered} disabled={bulkRunning} className="h-10 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
              Selecteaza filtrate ({filteredRepairs.length})
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} disabled={bulkRunning || selectedIds.size === 0} className="h-10 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
              Golește selecția
            </button>
            <button type="button" onClick={applyBulk} disabled={bulkRunning || selectedRepairs.length === 0} className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50">
              {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
              {bulkRunning ? "Se aplica loturile..." : `Aplica selectate (${selectedRepairs.length})`}
            </button>
          </div>
          {progress && (
            <div className="mt-3 text-xs text-muted-foreground">
              Procesate {progress.done}/{progress.total} · aplicate {progress.applied} · sarite {progress.skipped} · esuate {progress.failed}
            </div>
          )}
          <RepairIssuesList issues={issues} />
        </div>
      )}

      {message && <div className="mt-4 flex items-center gap-2 rounded-2xl border border-success-border bg-success-soft px-4 py-3 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> {message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}

      {repairs === null && !error && <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se pregătesc previzualizările...</div>}

      {repairs && repairs.length === 0 && !error && (
        <div className="mt-4"><EmptyState icon={CheckCircle2} title="Nu există reparații sigure de aplicat." subtitle="Problemele care necesită decizie umană rămân în tabul Probleme de date." /></div>
      )}

      {repairs && repairs.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/35 px-4 py-3 text-xs">
            <span className="font-semibold">Reparații afișate</span>
            <span className="rounded-full bg-card px-2.5 py-1 font-bold">{filteredRepairs.length}</span>
          </div>
          {filteredRepairs.map((repair) => (
            <RepairCard
              key={repair.id}
              repair={repair}
              expanded={expandedId === repair.id}
              busy={busyId === repair.id || bulkRunning}
              selected={selectedIds.has(repair.id)}
              onSelect={(checked) => setSelectedIds((current) => {
                const next = new Set(current);
                if (checked) next.add(repair.id); else next.delete(repair.id);
                return next;
              })}
              onToggle={() => setExpandedId((current) => current === repair.id ? "" : repair.id)}
              onApply={() => applyRepair(repair)}
            />
          ))}
        </div>
      )}
    </AdminCard>
  );
}