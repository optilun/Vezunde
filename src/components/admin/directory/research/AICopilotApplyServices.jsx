import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Check, MapPin } from "lucide-react";

// 2026-09-03, audit flow intrebari/recomandari. Pana acum, serviciile aprobate cu dovada
// in draftul de cercetare ajungeau intr-un sir de text pus in `source_notes`, iar adminul
// trebuia sa le reintroduca manual, unul cate unul, prin formularul de adaugare serviciu.
//
// Ecranul de mai jos le scrie direct pe o locatie existenta din director. Nu decide nimic:
// planul vine de la server (dry run), iar aplicarea cere token de confirmare, ca la
// loturile de import. Serviciile fara dovada aprobata apar in lista "blocate" si nu se
// scriu niciodata.

const input = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-foreground/40";

function errorText(error) {
  return error.response?.data?.error || error.message;
}

export default function AICopilotApplyServices({ draftId, duplicateCandidates }) {
  const [locationId, setLocationId] = useState("");
  const [plan, setPlan] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const call = async (payload) => base44.functions.invoke("directoryOps", {
    action: "apply_research_services",
    draft_id: draftId,
    ...payload,
  });

  const preview = async (targetId) => {
    const id = String(targetId || locationId || "").trim();
    if (!id) {
      setError("Alege o locatie sau scrie un location_id.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setConfirmation("");
    try {
      const res = await call({ location_id: id, dry_run: true });
      setLocationId(id);
      setPlan(res.data);
    } catch (callError) {
      setPlan(null);
      setError(errorText(callError));
    }
    setBusy(false);
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await call({ location_id: locationId, dry_run: false, confirmation });
      setResult(res.data);
      setPlan(null);
      setConfirmation("");
    } catch (callError) {
      setError(errorText(callError));
    }
    setBusy(false);
  };

  return (
    <div className="mt-2 rounded-md border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        Scrie pe o locatie existenta doar serviciile pe care le-ai aprobat mai sus, cu dovada din sursa.
        Nivelul este <span className="font-semibold">publicly_listed</span>: serviciul provine dintr-o sursa publica,
        nu de la furnizor. Locatiile revendicate sau verificate sunt refuzate — acolo serviciile le declara furnizorul.
      </p>

      {duplicateCandidates?.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold">Locatii asemanatoare gasite in director</p>
          <div className="mt-1.5 space-y-1">
            {duplicateCandidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => preview(candidate.id)}
                disabled={busy}
                className="flex w-full items-start gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{candidate.name}</span>
                  <span className="text-muted-foreground"> — {candidate.city}, {candidate.address}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className={input}
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          placeholder="sau lipeste direct un location_id"
          aria-label="Identificatorul locatiei"
        />
        <button
          type="button"
          onClick={() => preview()}
          disabled={busy || !locationId.trim()}
          className="rounded-md bg-secondary px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          Vezi ce s-ar scrie
        </button>
      </div>

      {plan && (
        <div className="mt-4 rounded-md border border-border p-3">
          <p className="text-sm font-semibold">
            {plan.location.name || plan.location.id}
            <span className="font-normal text-muted-foreground"> — {plan.location.city}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Are deja {plan.location.existing_service_count} servicii. Profil: {plan.location.profile_control_status}.
          </p>

          <p className="mt-3 text-xs font-semibold">Se scriu {plan.planned.length}</p>
          {plan.planned.length === 0 && <p className="text-xs text-muted-foreground">Niciun serviciu nou de scris.</p>}
          <ul className="mt-1 space-y-1">
            {plan.planned.map((item) => (
              <li key={item.service_key} className="text-xs">
                <Check className="mr-1 inline h-3 w-3 text-green-700" />
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">
                  {" "}· {item.matching_allowed ? "intra in potrivire" : "fara potrivire"} · {item.service_source_url}
                </span>
              </li>
            ))}
          </ul>

          {plan.skipped.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              <span className="font-semibold">Sarite ({plan.skipped.length}):</span>{" "}
              {plan.skipped.map((item) => item.service_key).join(", ")} — exista deja pe locatie.
            </p>
          )}

          {plan.blocked.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-400/50 bg-amber-50 p-2">
              <p className="text-xs font-semibold">
                <AlertTriangle className="mr-1 inline h-3 w-3" /> Blocate ({plan.blocked.length})
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {plan.blocked.map((item, index) => (
                  <li key={`${item.service_key}-${index}`}>{item.service_key} — {item.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.planned.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <label htmlFor="apply-services-confirmation" className="text-xs font-semibold">
                Scrie exact: <code className="rounded bg-secondary px-1 py-0.5">{plan.confirmation_required}</code>
              </label>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                <input
                  id="apply-services-confirmation"
                  className={input}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={plan.confirmation_required}
                />
                <button
                  type="button"
                  onClick={apply}
                  disabled={busy || confirmation.trim() !== plan.confirmation_required}
                  className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Aplica
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-green-600/40 bg-green-50/50 p-3">
          <p className="text-sm font-semibold text-green-800">
            {result.created.length} servicii scrise pe {result.location.name || result.location.id}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.created.map((item) => item.service_key).join(", ")}
          </p>
          {result.failed?.length > 0 && (
            <p className="mt-2 text-xs text-destructive">
              Esuate: {result.failed.map((item) => `${item.service_key} (${item.reason})`).join("; ")}
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
