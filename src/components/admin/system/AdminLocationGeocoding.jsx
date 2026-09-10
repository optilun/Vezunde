import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, DatabaseZap, Loader2, MapPin, RefreshCw, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { invokeDirectoryFunction } from "../../../../base44/shared/directoryFunctionRouting.js";
import AdminCard from "@/components/admin/ui/AdminCard";

const RUN_LABELS = {
  pending_total: "Fara pozitie exacta",
  already_positioned: "Au deja pozitie",
  owner_confirmed: "Confirmate de furnizor",
  without_address: "Fara adresa",
  shared_position_groups: "Grupuri suprapuse",
  shared_position_locations: "Locatii suprapuse",
};

const REJECTION_LABELS = {
  no_result: "Adresa negasita",
  outside_romania: "Rezultat in afara Romaniei",
  county_mismatch: "Alt judet decat cel din date",
  wrong_country: "Alta tara",
  null_island: "Coordonate 0,0",
  invalid_coordinates: "Coordonate invalide",
};

const BATCH_OPTIONS = [5, 15, 30];

function StatTile({ label, value, muted = false }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-heading text-xl font-bold ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

export default function AdminLocationGeocoding() {
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
      setError(reason.response?.data?.error || reason.message || "Nu am putut citi starea pozitiilor.");
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
      if (data.rate_limited) setMessage("Serviciul de geocodare a cerut incetinirea. Lotul s-a oprit curat si poate fi reluat.");
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
          setMessage("Rularea automata s-a oprit deoarece serviciul de geocodare a cerut incetinirea. Poate fi reluata fara sa repete cazurile finalizate.");
          break;
        }
        if ((data.attempted_count || 0) === 0) {
          setMessage("Rularea s-a oprit deoarece nu mai exista cazuri procesabile automat in coada curenta.");
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
    const confirmed = window.confirm(`Marcheaza ${count} locatii care impart coordonate aproximative ca pozitii la nivel de localitate? Coordonatele nu sunt sterse; locatiile reintra doar in coada de cautare a adresei exacte.`);
    if (!confirmed) return;

    setMarking(true);
    setError("");
    setMessage("");
    try {
      const response = await call({ action: "mark_shared_positions" });
      if (response.data?.error) throw new Error(response.data.error);
      setMessage(`${response.data?.marked || 0} locatii au fost marcate pentru regeocodare mai precisa.`);
      await loadSummary();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Pozitiile suprapuse nu au putut fi marcate.");
    } finally {
      setMarking(false);
    }
  };

  const rejections = Object.entries(lastRun?.rejected || {});

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-heading text-base font-bold">Pozitii pe harta</h2>
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Proceseaza pozitiile in loturi configurabile, marcheaza suprapunerile vechi si separa automat cazurile care trebuie trimise la alt geocoder sau verificate manual. Pozitiile confirmate de furnizor nu sunt suprascrise.
          </p>
        </div>
        <button type="button" onClick={loadSummary} disabled={loading || running || marking || auditing} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recalculeaza
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="w-[150px] text-[11px] font-semibold text-muted-foreground">
            MARIME LOT
            <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} disabled={running} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground disabled:opacity-50">
              {BATCH_OPTIONS.map((size) => <option key={size} value={size}>{size} locatii</option>)}
            </select>
          </label>
          <button type="button" onClick={runUntilDone} disabled={running || (summary?.pending_total ?? 0) <= 0} className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">
            {auto ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {auto ? "Se proceseaza automat..." : "Proceseaza automat pana la capat"}
          </button>
          <button type="button" onClick={runOnce} disabled={running || (summary?.pending_total ?? 0) <= 0} className="h-10 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            Ruleaza un lot ({batchSize})
          </button>
          <button type="button" onClick={runAudit} disabled={running || auditing || marking} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            {auditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
            Audit adrese
          </button>
          {(summary?.shared_position_locations ?? 0) > 0 && (
            <button type="button" onClick={markSharedPositions} disabled={running || marking || auditing} className="inline-flex h-10 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
              {marking ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Marcheaza suprapunerile ({summary.shared_position_locations})
            </button>
          )}
          {auto && (
            <button type="button" onClick={() => { stopRequested.current = true; }} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary">
              <Square className="h-3.5 w-3.5" /> Opreste
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">OpenStreetMap este apelat controlat, cu limita serviciului respectata. Cazurile epuizate ies din coada si sunt marcate pentru fallback sau verificare manuala.</p>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {message && <div className="mt-4 rounded-2xl border border-border bg-secondary/30 px-4 py-3 text-sm">{message}</div>}

      {summary && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label={RUN_LABELS.pending_total} value={summary.pending_total ?? 0} />
          <StatTile label={RUN_LABELS.already_positioned} value={summary.already_positioned ?? 0} muted />
          <StatTile label={RUN_LABELS.owner_confirmed} value={summary.owner_confirmed ?? 0} muted />
          <StatTile label={RUN_LABELS.without_address} value={summary.without_address ?? 0} muted />
          <StatTile label={RUN_LABELS.shared_position_groups} value={summary.shared_position_groups ?? 0} muted />
          <StatTile label={RUN_LABELS.shared_position_locations} value={summary.shared_position_locations ?? 0} muted />
        </div>
      )}

      {summary?.pending_total === 0 && !running && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 className="h-4 w-4" /> Toate locatiile publicate procesabile automat au iesit din coada de geocodare.
        </div>
      )}

      {audit && (
        <div className="mt-5 rounded-2xl border border-border bg-secondary/20 p-4">
          <div className="text-sm font-bold">Audit adrese</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Adrese cu strada si numar" value={audit.address_complete_street_and_number ?? 0} />
            <StatTile label="Adrese incomplete" value={audit.address_incomplete ?? 0} muted />
            <StatTile label="Necesita alt geocoder" value={audit.needs_geocoding_fallback ?? 0} />
            <StatTile label="Necesita verificare manuala" value={audit.needs_manual_review ?? 0} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Nominatim nu a rezolvat {audit.nominatim_failed_with_complete_address ?? 0} adrese complete · incercari epuizate {audit.attempts_exhausted ?? 0} · fallback Google {audit.google_fallback_enabled ? "activ" : "neactivat"}.
          </div>
        </div>
      )}

      {lastRun && (
        <div className="mt-5 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ultimul lot</div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>Incercari in sesiunea asta: <strong>{processed}</strong></span>
            <span>Procesate in ultimul lot: <strong>{lastRun.attempted_count ?? 0}</strong></span>
            <span>Geocodate: <strong>{lastRun.geocoded ?? 0}</strong></span>
            <span>Finalizate si scoase din coada: <strong>{lastRun.completed_count ?? 0}</strong></span>
            <span>Doar la nivel de localitate: <strong>{lastRun.fallback_used ?? 0}</strong></span>
            <span>Ramase: <strong>{lastRun.remaining ?? 0}</strong></span>
            {(lastRun.failed ?? 0) > 0 && <span className="text-red-700">Esuate tehnic: <strong>{lastRun.failed}</strong></span>}
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
