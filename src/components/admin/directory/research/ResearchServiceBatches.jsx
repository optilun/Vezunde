import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, RotateCcw } from "lucide-react";

// 2026-09-03, etapa 2. Aplicarea serviciilor pe o singura locatie exista din etapa 1, dar
// nu se putea retrage. Importul de locatii are snapshot, lot si rollback; serviciile nu
// aveau nimic, deci orice populare in masa ar fi fost ireversibila.
//
// Ecranul de mai jos nu decide nimic singur: planul, token-ul si rezultatul vin de la
// server. Aici se vad si se confirma.

const STATUS_LABELS = {
  draft: "In lucru",
  planned: "Planificat",
  approved: "Aprobat",
  running: "In executie",
  completed: "Finalizat",
  completed_with_errors: "Finalizat cu erori",
  failed: "Esuat",
  rolling_back: "Se retrage",
  rolled_back: "Retras",
  rollback_failed: "Retragere incompleta",
};

const input = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-foreground/40";
const button = "rounded-md px-4 py-2 text-xs font-semibold disabled:opacity-40";

function errorText(error) {
  return error.response?.data?.error || error.message;
}

// Clientul are deja rutarea instalata (src/api/base44FunctionRouting.js): numele logic
// e trimis prin envelope catre endpointul fizic directoryOps.
export function callResearchServiceBatch(payload) {
  return base44.functions.invoke("researchServiceBatchOps", payload);
}

export default function ResearchServiceBatches() {
  const [batches, setBatches] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [requiredToken, setRequiredToken] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await callResearchServiceBatch({ action: "list" });
      setBatches(res.data.batches || []);
    } catch (callError) {
      setError(errorText(callError));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (payload, onDone) => {
    setBusy(true);
    setError(null);
    try {
      const res = await callResearchServiceBatch(payload);
      if (res.data.batch) setDetail(res.data.batch);
      if (res.data.confirmation_required) setRequiredToken(res.data.confirmation_required);
      if (onDone) onDone(res.data);
      await load();
    } catch (callError) {
      setError(errorText(callError));
    }
    setBusy(false);
  };

  const open = async (batchId) => {
    setOpenId(batchId);
    setConfirmation("");
    setRequiredToken("");
    setDetail(null);
    await act({ action: "status", batch_id: batchId });
  };

  // Executia avanseaza in bucati; ruleaza pana cand serverul spune ca s-a terminat.
  const run = async () => {
    let guard = 0;
    let finished = false;
    let token = confirmation;
    while (!finished && guard < 200) {
      guard += 1;
      // eslint-disable-next-line no-await-in-loop
      const res = await callResearchServiceBatch({ action: "run", batch_id: openId, confirmation: token })
        .catch((callError) => { setError(errorText(callError)); return null; });
      if (!res) return;
      token = "";
      finished = res.data.finished === true;
      setDetail(res.data.batch);
    }
    await load();
  };

  if (!batches) return <p className="text-sm text-muted-foreground">Se incarca loturile...</p>;

  if (openId && detail) {
    const rollbackToken = `ROLLBACK-SERVICII ${detail.batch_key} ${detail.applied_service_ids.length}`;
    const canPlan = ["draft", "planned"].includes(detail.status);
    const canRun = ["planned", "approved", "running"].includes(detail.status);
    const canRollback = ["completed", "completed_with_errors", "rollback_failed"].includes(detail.status);

    return (
      <div className="max-w-3xl">
        <button type="button" onClick={() => { setOpenId(null); setDetail(null); }} className="text-sm underline">
          Inapoi la loturi
        </button>

        <h3 className="mt-3 font-heading text-sm font-bold">
          {detail.batch_key} <span className="font-normal text-muted-foreground">— {STATUS_LABELS[detail.status] || detail.status}</span>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {detail.pair_count} perechi · {detail.planned_count} servicii planificate · {detail.created_count} scrise
          {detail.failed_count > 0 && ` · ${detail.failed_count} esuate`}
        </p>

        {detail.plan.length > 0 && (
          <div className="mt-4 space-y-2">
            {detail.plan.map((entry) => (
              <div key={`${entry.draft_id}-${entry.location_id}`} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">
                  {entry.location_name || entry.location_id}
                  {entry.location_city && <span className="font-normal text-muted-foreground"> — {entry.location_city}</span>}
                </p>
                {entry.error ? (
                  <p className="mt-1 text-xs text-destructive">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />{entry.error}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(entry.planned || []).length} de scris
                    {(entry.skipped || []).length > 0 && ` · ${entry.skipped.length} deja existente`}
                    {(entry.blocked || []).length > 0 && ` · ${entry.blocked.length} blocate`}
                    {(entry.planned || []).length > 0 && `: ${entry.planned.map((item) => item.service_key).join(", ")}`}
                  </p>
                )}
                {(entry.blocked || []).length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {entry.blocked.map((item, index) => (
                      <li key={`${item.service_key}-${index}`}>{item.service_key} — {item.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {canPlan && (
            <button type="button" onClick={() => act({ action: "plan", batch_id: openId })} disabled={busy} className={`${button} bg-secondary`}>
              Planifica (dry run)
            </button>
          )}
        </div>

        {canRun && detail.status === "planned" && requiredToken && (
          <div className="mt-4 rounded-md border border-border p-3">
            <label htmlFor="batch-confirmation" className="text-xs font-semibold">
              Scrie exact: <code className="rounded bg-secondary px-1 py-0.5">{requiredToken}</code>
            </label>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input id="batch-confirmation" className={input} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={requiredToken} />
              <button type="button" onClick={run} disabled={busy || confirmation.trim() !== requiredToken} className={`${button} bg-primary text-primary-foreground`}>
                Aplica lotul
              </button>
            </div>
          </div>
        )}

        {canRun && detail.status === "running" && (
          <button type="button" onClick={run} disabled={busy} className={`${button} mt-4 bg-primary text-primary-foreground`}>
            Continua executia ({detail.execution_cursor}/{detail.pair_count})
          </button>
        )}

        {canRollback && (
          <div className="mt-6 rounded-md border border-destructive/40 p-3">
            <p className="text-xs font-semibold">
              <RotateCcw className="mr-1 inline h-3 w-3" /> Retrage lotul
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sterge cele {detail.applied_service_ids.length} servicii scrise de acest lot. Randurile modificate intre timp
              (confirmate de furnizor sau verificate) sunt pastrate si raportate.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input className={input} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={rollbackToken} aria-label="Confirmare retragere" />
              <button
                type="button"
                onClick={() => act({ action: "rollback", batch_id: openId, confirmation })}
                disabled={busy || confirmation.trim() !== rollbackToken}
                className={`${button} border border-destructive text-destructive`}
              >
                Retrage
              </button>
            </div>
          </div>
        )}

        {detail.rollback_result && (
          <p className="mt-3 text-xs text-muted-foreground">
            Retrase: {detail.rollback_result.removed?.length || 0}. Pastrate: {detail.rollback_result.kept?.length || 0}
            {detail.rollback_result.kept?.length > 0 && ` (${detail.rollback_result.kept.map((item) => item.reason).join("; ")})`}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="text-xs text-muted-foreground">
        Un lot aplica serviciile aprobate din mai multe drafturi de cercetare, cu o singura aprobare si cu posibilitatea
        de a retrage tot. Perechile se adauga din ecranul de review al fiecarui draft.
      </p>

      {batches.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Niciun lot inca.</p>}

      <div className="mt-4 space-y-2">
        {batches.map((batch) => (
          <button
            key={batch.id}
            type="button"
            onClick={() => open(batch.id)}
            className="block w-full rounded-md border border-border px-3 py-2 text-left hover:bg-secondary"
          >
            <span className="text-sm font-medium">{batch.batch_key}</span>
            <span className="text-xs text-muted-foreground">
              {" "}— {STATUS_LABELS[batch.status] || batch.status} · {batch.pair_count} perechi · {batch.created_count} servicii scrise
            </span>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
