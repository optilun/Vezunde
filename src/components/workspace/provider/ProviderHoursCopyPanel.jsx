import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

function operationId() {
  return `hours_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function displayName(location) {
  return location.public_display_name || location.name || "Locatie";
}

function displayPlace(location) {
  return location.locality_name || location.city || location.county_name || location.county || "";
}

function canManageHours(location) {
  return Array.isArray(location.capabilities) && location.capabilities.includes("location.manage_operational_status");
}

export default function ProviderHoursCopyPanel({ workspace, currentLocationId, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(currentLocationId || "");
  const [targetIds, setTargetIds] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [currentOperationId, setCurrentOperationId] = useState("");

  const locations = useMemo(() => {
    const all = Array.isArray(workspace?.locations) ? workspace.locations : [];
    const current = all.find((location) => location.id === currentLocationId);
    if (!current?.organization_id) return [];
    return all.filter(
      (location) =>
        location.organization_id === current.organization_id &&
        canManageHours(location) &&
        location.profile_control_status !== "suspended" &&
        location.status !== "suspendata",
    );
  }, [workspace, currentLocationId]);

  if (locations.length < 2) return null;

  const availableTargets = locations.filter((location) => location.id !== sourceId);
  const needsReplaceConfirmation = Boolean(
    preview?.targets?.some((target) => target.has_existing_schedule),
  );

  const resetPreview = () => {
    setPreview(null);
    setConfirmReplace(false);
    setResult(null);
    setError("");
    setCurrentOperationId("");
  };

  const toggleTarget = (locationId) => {
    resetPreview();
    setTargetIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId],
    );
  };

  const loadPreview = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    const response = await base44.functions
      .invoke("copyProviderOpeningHours", {
        action: "preview",
        source_location_id: sourceId,
        target_location_ids: targetIds,
      })
      .catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setLoading(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setPreview(response.data.preview);
    setCurrentOperationId(operationId());
  };

  const copyHours = async () => {
    setLoading(true);
    setError("");
    const response = await base44.functions
      .invoke("copyProviderOpeningHours", {
        action: "copy",
        source_location_id: sourceId,
        target_location_ids: targetIds,
        confirm_replace_existing: confirmReplace,
        operation_id: currentOperationId,
      })
      .catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setLoading(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setResult(response.data);
    onRefresh?.();
  };

  return (
    <section className="mb-5 rounded-[20px] border border-foreground/10 bg-card shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
            <Copy className="h-4 w-4" />
          </span>
          <span>
            <strong className="block text-sm">Copiaza programul intre locatii</strong>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Selectezi explicit sursa si locatiile tinta. Nimic nu se copiaza automat.
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/70 px-4 py-5 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-xs font-semibold">Locatia sursa</label>
              <select
                value={sourceId}
                onChange={(event) => {
                  setSourceId(event.target.value);
                  setTargetIds((ids) => ids.filter((id) => id !== event.target.value));
                  resetPreview();
                }}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {displayName(location)}{displayPlace(location) ? ` - ${displayPlace(location)}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold">Locatii tinta</label>
                <span className="text-[11px] text-muted-foreground">{targetIds.length} selectate</span>
              </div>
              <div className="mt-2 grid gap-2">
                {availableTargets.map((location) => (
                  <label key={location.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-3">
                    <input
                      type="checkbox"
                      checked={targetIds.includes(location.id)}
                      onChange={() => toggleTarget(location.id)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span className="min-w-0 text-sm">
                      <strong className="block truncate">{displayName(location)}</strong>
                      {displayPlace(location) && <span className="block truncate text-xs text-muted-foreground">{displayPlace(location)}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {!preview && (
            <button
              type="button"
              onClick={loadPreview}
              disabled={loading || !sourceId || targetIds.length === 0}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Vezi preview-ul
            </button>
          )}

          {preview && (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border bg-background p-4">
                <div className="text-xs font-semibold text-muted-foreground">Program sursa</div>
                <div className="mt-1 text-sm font-bold">{preview.source.name}</div>
                <p className="mt-2 text-sm leading-relaxed">{preview.source.opening_hours}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {preview.source.exceptions.length} exceptii de program vor fi copiate.
                </p>
              </div>

              <div className="grid gap-2">
                {preview.targets.map((target) => (
                  <div key={target.id} className="rounded-xl border border-border px-3 py-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong>{target.name}</strong>
                        {target.locality && <div className="text-xs text-muted-foreground">{target.locality}</div>}
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                        {target.has_existing_schedule ? "Program existent" : "Fara program"}
                      </span>
                    </div>
                    {target.current_opening_hours && (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Acum: {target.current_opening_hours}</p>
                    )}
                  </div>
                ))}
              </div>

              {needsReplaceConfirmation && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    onChange={(event) => setConfirmReplace(event.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <strong className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Confirm inlocuirea</strong>
                    <span className="mt-1 block text-xs leading-relaxed">
                      Programul existent al locatiilor marcate va fi inlocuit. Serviciile, specialistii, datele de contact si publicarea nu sunt afectate.
                    </span>
                  </span>
                </label>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={copyHours}
                  disabled={loading || (needsReplaceConfirmation && !confirmReplace) || Boolean(result)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Confirma si copiaza
                </button>
                <button
                  type="button"
                  onClick={resetPreview}
                  disabled={loading}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
                >
                  Modifica selectia
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          {result && (
            <div className="mt-5 rounded-2xl border border-border bg-background p-4">
              <strong className="text-sm">Rezultatul operatiei</strong>
              <div className="mt-3 grid gap-2">
                {result.results.map((item) => (
                  <div key={item.location_id} className="flex items-start justify-between gap-3 text-sm">
                    <span>{item.name}</span>
                    <span className="text-right text-xs font-semibold">
                      {item.status === "success" && "Copiat"}
                      {item.status === "duplicate_skipped" && "Deja procesat"}
                      {item.status === "error" && `Eroare${item.error ? `: ${item.error}` : ""}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
