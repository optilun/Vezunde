import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, DatabaseZap, Loader2, MapPin, RefreshCw, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { invokeDirectoryFunction } from "../../../../base44/shared/directoryFunctionRouting.js";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminHint from "@/components/admin/ui/AdminHint";
import StatCard from "@/components/admin/ui/StatCard";
import { useAdminConfirm } from "@/components/admin/ui/AdminConfirm";

const RUN_LABELS = {
  pending_total: "Fără poziție exactă",
  already_positioned: "Au deja poziție",
  owner_confirmed: "Confirmate de furnizor",
  without_address: "Fără adresă",
  shared_position_groups: "Grupuri suprapuse",
  shared_position_locations: "Locații suprapuse",
};

const REJECTION_LABELS = {
  no_result: "Adresă negăsită",
  outside_romania: "Rezultat în afara României",
  county_mismatch: "Alt județ decât cel din date",
  wrong_country: "Altă țară",
  null_island: "Coordonate 0,0",
  invalid_coordinates: "Coordonate invalide",
};

const BATCH_OPTIONS = [5, 15, 30];

// 2026-10-07: textul explicativ lung a trecut în ⓘ; contoarele folosesc StatCard; confirmarea
// folosește dialogul comun. Logica de geocodare nu s-a schimbat.
export default function AdminLocationGeocoding() {
  const confirm = useAdminConfirm();
  const [summary, setSummary] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [marking, setMarking] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [processed, setProcessed] = useState(0);
  const [batchSize, setBatchSize] = useState(15);
  const stopRequested = useRef(false);

  const call = useCallback((payload) => invokeDirectoryFunction(base44, "directoryGeocodeOps", payload), []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await call({ action: "preview" });
      if (response.data?.error) throw new Error(response.data.error);
      setSummary(response.data);
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut citi starea pozițiilor.");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const runBatch = useCallback(async () => {
    const response = await call({ action: "run", batch_size: batchSize });
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  }, [call, batchSize]);

  const runOnce = async () => {
    setRunning(true);
    setError("");
    setMessage("");
    try {
      const data = await runBatch();
      setLastRun(data);
      setProcessed((current) => current + (data.attempted_count || 0));
      setSummary(data);
      if (data.rate_limited) setMessage("Serviciul de geocodare a cerut încetinirea. Lotul s-a oprit curat și poate fi reluat.");
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Lotul nu a putut fi procesat.");
    } finally {
      setRunning(false);
    }
  };

  const runUntilDone = async () => {
    stopRequested.current = false;
    setAuto(true);
    setRunning(true);
    setError("");
    setMessage("");
    try {
      for (let round = 0; round < 200; round += 1) {
        if (stopRequested.current) break;
        const data = await runBatch();
        setLastRun(data);
        setProcessed((current) => current + (data.attempted_count || 0));
        setSummary(data);
        if ((data.remaining || 0) <= 0) break;
        if (data.rate_limited) {
          setMessage("Rularea automată s-a oprit: serviciul de geocodare a cerut încetinirea. O poți relua fără să repeți cazurile finalizate.");
          break;
        }
        if ((data.attempted_count || 0) === 0) {
          setMessage("Rularea s-a oprit: nu mai există cazuri procesabile automat în coada curentă.");
          break;
        }
      }
      await loadSummary();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Rularea s-a oprit cu o eroare.");
    } finally {
      setAuto(false);
      setRunning(false);
      stopRequested.current = false;
    }
  };

  const runAudit = async () => {
    setAuditing(true);
    setError("");
    setMessage("");
    try {
      const response = await call({ action: "audit" });
      if (response.data?.error) throw new Error(response.data.error);
      setAudit(response.data);
      setSummary(response.data);
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Auditul adreselor nu a putut fi rulat.");
    } finally {
      setAuditing(false);
    }
  };

  const markSharedPositions = async () => {
    const count = summary?.shared_position_locations || 0;
    if (count <= 0 || marking) return;
    const confirmed = await confirm({
      title: `Marchezi ${count} ${count === 1 ? "locație" : "locații"}?`,
      description: "Au coordonate aproximative comune și sunt marcate ca poziții la nivel de localitate. Coordonatele nu se șterg; locațiile revin doar în coada de căutare a adresei exacte.",
      confirmLabel: "Marchează",
    });
    if (!confirmed) return;

    setMarking(true);
    setError("");
    setMessage("");
    try {
      const response = await call({ action: "mark_shared_positions" });
      if (response.data?.error) throw new Error(response.data.error);
      setMessage(`${response.data?.marked || 0} locații au fost marcate pentru o geocodare mai precisă.`);
      await loadSummary();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Pozițiile suprapuse nu au putut fi marcate.");
    } finally {
      setMarking(false);
    }
  };

  const rejections = Object.entries(lastRun?.rejected || {});

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-heading text-base font-bold">Poziții pe hartă</h2>
          <AdminHint label="Cum funcționează geocodarea">
            Procesează pozițiile în loturi, marchează suprapunerile vechi și separă cazurile care trebuie trimise la alt geocoder sau verificate manual. Pozițiile confirmate de furnizor nu se suprascriu. OpenStreetMap e apelat controlat, cu limita serviciului respectată; cazurile epuizate ies din coadă și sunt marcate pentru fallback sau verificare manuală.
          </AdminHint>
        </div>
        <button type="button" onClick={loadSummary} disabled={loading || running || marking || auditing} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Recalculează
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-[150px] text-[11px] font-semibold text-muted-foreground">
            Mărime lot
            <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} disabled={running} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground disabled:opacity-50">
              {BATCH_OPTIONS.map((size) => <option key={size} value={size}>{size} locații</option>)}
            </select>
          </label>
          <button type="button" onClick={runUntilDone} disabled={running || (summary?.pending_total ?? 0) <= 0} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {auto ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
            {auto ? "Se procesează automat..." : "Procesează automat până la capăt"}
          </button>
          <button type="button" onClick={runOnce} disabled={running || (summary?.pending_total ?? 0) <= 0} className="h-10 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            Rulează un lot ({batchSize})
          </button>
          <button type="button" onClick={runAudit} disabled={running || auditing || marking} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" aria-hidden="true" />}
            Audit adrese
          </button>
          {(summary?.shared_position_locations ?? 0) > 0 && (
            <button type="button" onClick={markSharedPositions} disabled={running || marking || auditing} className="inline-flex h-10 items-center gap-2 rounded-full border border-warning-border bg-warning-soft px-4 text-xs font-semibold text-warning hover:bg-warning-soft/70 disabled:opacity-50">
              {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}
              Marchează suprapunerile ({summary.shared_position_locations})
            </button>
          )}
          {auto && (
            <button type="button" onClick={() => { stopRequested.current = true; }} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary">
              <Square className="h-3.5 w-3.5" aria-hidden="true" /> Oprește
            </button>
          )}
        </div>
      </div>

      {error && <div role="alert" className="mt-4 rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>}
      {message && <div role="status" className="mt-4 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm">{message}</div>}

      {summary && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={RUN_LABELS.pending_total} value={summary.pending_total ?? 0} tone={(summary.pending_total ?? 0) > 0 ? "warning" : "neutral"} />
          <StatCard label={RUN_LABELS.already_positioned} value={summary.already_positioned ?? 0} />
          <StatCard label={RUN_LABELS.owner_confirmed} value={summary.owner_confirmed ?? 0} />
          <StatCard label={RUN_LABELS.without_address} value={summary.without_address ?? 0} />
          <StatCard label={RUN_LABELS.shared_position_groups} value={summary.shared_position_groups ?? 0} />
          <StatCard label={RUN_LABELS.shared_position_locations} value={summary.shared_position_locations ?? 0} />
        </div>
      )}

      {summary?.pending_total === 0 && !running && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-success-border bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Toate locațiile publicate care se pot procesa automat au ieșit din coada de geocodare.
        </div>
      )}

      {audit && (
        <div className="mt-5 rounded-2xl border border-border bg-secondary/20 p-4">
          <div className="text-sm font-bold">Audit adrese</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Adrese cu stradă și număr" value={audit.address_complete_street_and_number ?? 0} />
            <StatCard label="Adrese incomplete" value={audit.address_incomplete ?? 0} />
            <StatCard label="Necesită alt geocoder" value={audit.needs_geocoding_fallback ?? 0} />
            <StatCard label="Necesită verificare manuală" value={audit.needs_manual_review ?? 0} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Nominatim nu a rezolvat {audit.nominatim_failed_with_complete_address ?? 0} adrese complete · încercări epuizate {audit.attempts_exhausted ?? 0} · fallback Google {audit.google_fallback_enabled ? "activ" : "neactivat"}.
          </div>
        </div>
      )}

      {lastRun && (
        <div className="mt-5 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ultimul lot</div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>Încercări în această sesiune: <strong>{processed}</strong></span>
            <span>Procesate în ultimul lot: <strong>{lastRun.attempted_count ?? 0}</strong></span>
            <span>Geocodate: <strong>{lastRun.geocoded ?? 0}</strong></span>
            <span>Finalizate și scoase din coadă: <strong>{lastRun.completed_count ?? 0}</strong></span>
            <span>Doar la nivel de localitate: <strong>{lastRun.fallback_used ?? 0}</strong></span>
            <span>Rămase: <strong>{lastRun.remaining ?? 0}</strong></span>
            {(lastRun.failed ?? 0) > 0 && <span className="text-danger">Eșuate tehnic: <strong>{lastRun.failed}</strong></span>}
          </div>
          {rejections.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-muted-foreground">Respinse, cu motiv</div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {rejections.map(([reason, count]) => <li key={reason}>{REJECTION_LABELS[reason] || reason}: <strong>{count}</strong></li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  );
}
