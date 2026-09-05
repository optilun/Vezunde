import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, RefreshCw, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { invokeDirectoryFunction } from "../../../../base44/shared/directoryFunctionRouting.js";
import AdminCard from "@/components/admin/ui/AdminCard";

// Completarea pozitiilor pe harta, din adresele publice.
//
// 2026-09-05. Harta de pe ecranul de rezultate are nevoie de latitudine si longitudine pentru
// fiecare optiune. Pe profilul unei locatii harta merge doar cu adresa, pentru ca iframe-ul isi
// face singur cautarea - dar acolo este un singur loc. Cu noua optiuni pe aceeasi harta nu se
// poate: fiecare marcator are nevoie de numere.
//
// De aceea conversia se face o data si se pastreaza, in loc sa fie refacuta la fiecare cautare a
// fiecarui pacient. Ecranul asta e butonul care o porneste.
//
// Loturile sunt mici si repetate pentru ca serviciul de geocodare accepta o cerere pe secunda,
// iar o functie backend are timp limitat de executie. Butonul "Continua automat" reapeleaza pana
// la zero; oprirea este posibila oricand, iar reluarea nu reface munca deja facuta.

const RUN_LABELS = {
  pending_total: "Fara pozitie",
  already_positioned: "Au deja pozitie",
  owner_confirmed: "Confirmate de furnizor",
  without_address: "Fara adresa",
};

const REJECTION_LABELS = {
  no_result: "Adresa negasita",
  outside_romania: "Rezultat in afara Romaniei",
  county_mismatch: "Alt judet decat cel din date",
  wrong_country: "Alta tara",
  null_island: "Coordonate 0,0",
  invalid_coordinates: "Coordonate invalide",
};

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
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [auto, setAuto] = useState(false);
  const [error, setError] = useState("");
  const [lastRun, setLastRun] = useState(null);
  const [processed, setProcessed] = useState(0);
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
    const response = await call({ action: "run", batch_size: 15 });
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  }, [call]);

  const runOnce = async () => {
    setRunning(true);
    setError("");
    try {
      const data = await runBatch();
      setLastRun(data);
      setProcessed((current) => current + (data.geocoded || 0));
      setSummary(data);
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
    try {
      // Bucla se opreste in trei situatii: nu mai exista locatii in asteptare, un lot nu a reusit
      // sa geocodeze nimic (deci reluarea ar fi inutila), sau adminul a apasat "Oprește".
      for (let round = 0; round < 200; round += 1) {
        if (stopRequested.current) break;
        const data = await runBatch();
        setLastRun(data);
        setProcessed((current) => current + (data.geocoded || 0));
        setSummary(data);
        if ((data.remaining || 0) <= 0) break;
        if ((data.geocoded || 0) === 0) break;
      }
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Rularea s-a oprit cu o eroare.");
    } finally {
      setAuto(false);
      setRunning(false);
      stopRequested.current = false;
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
            Completeaza latitudinea si longitudinea locatiilor publicate, derivate din adresa lor
            publica prin OpenStreetMap. Pozitiile sunt marcate ca aproximative si nu inlocuiesc
            niciodata una confirmata de furnizor. Un rezultat din alt judet decat cel din datele
            noastre este respins, nu aproximat.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSummary}
          disabled={loading || running}
          className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recalculeaza
        </button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {summary && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={RUN_LABELS.pending_total} value={summary.pending_total ?? 0} />
          <StatTile label={RUN_LABELS.already_positioned} value={summary.already_positioned ?? 0} muted />
          <StatTile label={RUN_LABELS.owner_confirmed} value={summary.owner_confirmed ?? 0} muted />
          <StatTile label={RUN_LABELS.without_address} value={summary.without_address ?? 0} muted />
        </div>
      )}

      {summary?.pending_total === 0 && !running && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 className="h-4 w-4" /> Toate locatiile publicate care au adresa au deja o pozitie pe harta.
        </div>
      )}

      {(summary?.pending_total ?? 0) > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runUntilDone}
            disabled={running}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {auto ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {auto ? "Se completeaza..." : "Continua automat pana la capat"}
          </button>
          <button
            type="button"
            onClick={runOnce}
            disabled={running}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Un singur lot (15)
          </button>
          {auto && (
            <button
              type="button"
              onClick={() => { stopRequested.current = true; }}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary"
            >
              <Square className="h-3.5 w-3.5" /> Opreste
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            Cate o cerere pe secunda, conform politicii OpenStreetMap. Rularea poate fi oprita si reluata oricand.
          </span>
        </div>
      )}

      {lastRun && (
        <div className="mt-5 rounded-2xl border border-border bg-secondary/30 px-4 py-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ultimul lot</div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span>Completate in sesiunea asta: <strong>{processed}</strong></span>
            <span>Din care doar la nivel de localitate: <strong>{lastRun.fallback_used ?? 0}</strong></span>
            <span>Ramase: <strong>{lastRun.remaining ?? 0}</strong></span>
            {(lastRun.failed ?? 0) > 0 && <span className="text-red-700">Esuate tehnic: <strong>{lastRun.failed}</strong></span>}
          </div>
          {rejections.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-muted-foreground">Respinse, cu motiv</div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {rejections.map(([reason, count]) => (
                  <li key={reason}>{REJECTION_LABELS[reason] || reason}: <strong>{count}</strong></li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Locatiile respinse raman fara pin si sunt numarate sub harta. Nu li se atribuie o
                pozitie aproximativa la intamplare - un pin gresit ar fi crezut real.
              </p>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  );
}
