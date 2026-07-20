import React, { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Copy, FileEdit, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

function operationId() {
  return `services_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function displayName(location) {
  return location.public_display_name || location.name || "Locatie";
}

function displayPlace(location) {
  return location.locality_name || location.locality || location.city || location.county_name || location.county || "";
}

function canManageServices(location) {
  return Array.isArray(location.capabilities) && location.capabilities.includes("location.manage_content");
}

function resultLabel(status) {
  if (status === "draft_created") return "Draft creat";
  if (status === "draft_updated") return "Draft actualizat";
  if (status === "duplicate_skipped") return "Deja procesat";
  if (status === "blocked") return "Blocat";
  return "Eroare";
}

export default function ProviderServicesCopyPanel({ workspace, currentLocationId, onRefresh, onCopied }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(currentLocationId || "");
  const [targetIds, setTargetIds] = useState([]);
  const [mode, setMode] = useState("merge");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmReplaceServices, setConfirmReplaceServices] = useState(false);
  const [confirmReplaceDrafts, setConfirmReplaceDrafts] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [currentOperationId, setCurrentOperationId] = useState("");

  const locations = useMemo(() => {
    const all = Array.isArray(workspace?.locations) ? workspace.locations : [];
    const current = all.find((location) => location.id === currentLocationId);
    if (!current?.organization_id) return [];
    return all.filter(
      (location) =>
        location.organization_id === current.organization_id
        && canManageServices(location)
        && location.profile_control_status !== "suspended"
        && location.status !== "suspendata",
    );
  }, [workspace, currentLocationId]);

  if (locations.length < 2) return null;

  const availableTargets = locations.filter((location) => location.id !== sourceId);
  const actionableTargets = preview?.targets?.filter((target) => !target.blocked) || [];
  const needsServiceReplacement = mode === "replace" && actionableTargets.some((target) => target.removed_count > 0);
  const needsDraftReplacement = actionableTargets.some((target) => target.has_active_draft && target.active_draft_owned_by_user);
  const blockedCount = preview?.targets?.filter((target) => target.blocked).length || 0;

  const resetPreview = () => {
    setPreview(null);
    setConfirmReplaceServices(false);
    setConfirmReplaceDrafts(false);
    setResult(null);
    setError("");
    setCurrentOperationId("");
  };

  const toggleTarget = (locationId) => {
    resetPreview();
    setTargetIds((current) => (
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId]
    ));
  };

  const loadPreview = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    const response = await base44.functions
      .invoke("copyProviderServiceConfiguration", {
        action: "preview",
        mode,
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

  const copyServices = async () => {
    setLoading(true);
    setError("");
    const response = await base44.functions
      .invoke("copyProviderServiceConfiguration", {
        action: "copy",
        mode,
        source_location_id: sourceId,
        target_location_ids: targetIds,
        confirm_replace_services: confirmReplaceServices,
        confirm_replace_existing_drafts: confirmReplaceDrafts,
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
    onCopied?.();
  };

  return (
    <section className="mx-auto mb-5 w-full max-w-[1500px] rounded-[20px] border border-foreground/10 bg-card shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
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
            <strong className="block text-sm">Copiaza serviciile intre locatii</strong>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Operatia creeaza drafturi. Serviciile nu sunt publicate automat.
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/70 px-4 py-5 sm:px-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
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
                <div className="text-xs font-semibold">Modul de copiere</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => { setMode("merge"); resetPreview(); }}
                    className={`rounded-2xl border px-4 py-3 text-left ${mode === "merge" ? "border-foreground bg-secondary/45" : "border-border bg-background"}`}
                  >
                    <strong className="block text-sm">Adauga serviciile lipsa</strong>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Pastreaza serviciile deja configurate la destinatie.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("replace"); resetPreview(); }}
                    className={`rounded-2xl border px-4 py-3 text-left ${mode === "replace" ? "border-foreground bg-secondary/45" : "border-border bg-background"}`}
                  >
                    <strong className="block text-sm">Aliniaza cu sursa</strong>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Propune eliminarea serviciilor canonice care nu exista la sursa.</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-secondary/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                Specialistii, echipamentele, facilitatile, programul si datele de contact nu se copiaza. Cheile legacy sau necunoscute nu sunt eliminate automat.
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold">Locatii tinta</label>
                <span className="text-[11px] text-muted-foreground">{targetIds.length} selectate</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {availableTargets.map((location) => (
                  <label key={location.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-3 py-3">
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground">Configuratie sursa aprobata</div>
                    <div className="mt-1 text-sm font-bold">{preview.source.name}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{preview.source.service_count} servicii canonice vor fi analizate pentru fiecare locatie tinta.</p>
                  </div>
                  {preview.source.has_unapproved_changes && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-900">Draftul sursei nu se copiaza</span>
                  )}
                </div>
              </div>

              <div className="grid gap-2 lg:grid-cols-2">
                {preview.targets.map((target) => (
                  <div key={target.id} className={`rounded-2xl border p-4 ${target.blocked ? "border-amber-200 bg-amber-50/60" : "border-border bg-background"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm">{target.name}</strong>
                        {target.locality && <div className="truncate text-xs text-muted-foreground">{target.locality}</div>}
                      </div>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                        {target.blocked ? "Necesita rezolvare" : target.has_active_draft ? "Draft existent" : "Pregatita"}
                      </span>
                    </div>
                    {target.blocked ? (
                      <p className="mt-3 text-xs leading-relaxed text-amber-950">{target.blocked_reason}</p>
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-secondary/45 px-2 py-2"><strong className="block text-base">{target.added_count}</strong><span className="text-[10px] text-muted-foreground">Adaugate</span></div>
                        <div className="rounded-xl bg-secondary/45 px-2 py-2"><strong className="block text-base">{target.removed_count}</strong><span className="text-[10px] text-muted-foreground">Eliminate</span></div>
                        <div className="rounded-xl bg-secondary/45 px-2 py-2"><strong className="block text-base">{target.skipped_services.length}</strong><span className="text-[10px] text-muted-foreground">Incompatibile</span></div>
                      </div>
                    )}
                    {target.skipped_services.length > 0 && (
                      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                        Nu se copiaza aici: {target.skipped_services.slice(0, 3).map((item) => item.label).join(", ")}{target.skipped_services.length > 3 ? ` si inca ${target.skipped_services.length - 3}` : ""}.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {blockedCount > 0 && actionableTargets.length > 0 && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-950">
                  {blockedCount} {blockedCount === 1 ? "locatie va fi omisa" : "locatii vor fi omise"}. Drafturile pot fi create pentru celelalte locatii.
                </p>
              )}

              {needsDraftReplacement && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={confirmReplaceDrafts}
                    onChange={(event) => setConfirmReplaceDrafts(event.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <strong className="flex items-center gap-2"><FileEdit className="h-4 w-4" /> Confirm inlocuirea drafturilor mele</strong>
                    <span className="mt-1 block text-xs leading-relaxed">Drafturile existente indicate in preview vor fi inlocuite cu configuratia rezultata din aceasta operatiune.</span>
                  </span>
                </label>
              )}

              {needsServiceReplacement && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                  <input
                    type="checkbox"
                    checked={confirmReplaceServices}
                    onChange={(event) => setConfirmReplaceServices(event.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <strong className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Confirm alinierea serviciilor</strong>
                    <span className="mt-1 block text-xs leading-relaxed">Serviciile canonice absente la sursa vor fi marcate pentru eliminare in draft. Nimic nu dispare public pana la trimiterea si aprobarea draftului.</span>
                  </span>
                </label>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={copyServices}
                  disabled={loading || actionableTargets.length === 0 || (needsDraftReplacement && !confirmReplaceDrafts) || (needsServiceReplacement && !confirmReplaceServices) || Boolean(result)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:opacity-40"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Creeaza drafturile
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
              <p className="mt-1 text-xs text-muted-foreground">Drafturile create trebuie verificate si trimise separat spre aprobare.</p>
              <div className="mt-3 grid gap-2">
                {result.results.map((item) => (
                  <div key={item.location_id} className="flex items-start justify-between gap-3 text-sm">
                    <span>{item.name}</span>
                    <span className="text-right text-xs font-semibold">
                      {resultLabel(item.status)}{item.error ? `: ${item.error}` : ""}
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
