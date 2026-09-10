import React, { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

function scoreTone(score) {
  if (score >= 95) return { label: "Duplicat aproape sigur", className: "bg-destructive/10 text-destructive" };
  if (score >= 90) return { label: "Foarte probabil duplicat", className: "bg-amber-100 text-amber-800" };
  return { label: "De verificat", className: "bg-secondary text-muted-foreground" };
}

function pairKey(pair) {
  return [pair.organizations[0].id, pair.organizations[1].id].sort().join("::");
}

function OrganizationColumn({ organization }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <Building2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="break-words text-sm font-bold">{organization.name || "Fara nume"}</div>
          <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{organization.id}</div>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        <div><span className="font-semibold text-foreground">Operator:</span> {organization.legal_name || "neconfirmat"}</div>
        {organization.website && <div className="break-all"><span className="font-semibold text-foreground">Site:</span> {organization.website}</div>}
        <div>
          <span className="font-semibold text-foreground">{organization.location_count}</span> {organization.location_count === 1 ? "locatie" : "locatii"}
          {organization.data_quality_status ? ` · date ${organization.data_quality_status}` : ""}
          {organization.publication_status ? ` · ${organization.publication_status}` : ""}
        </div>
      </div>
      {organization.locations?.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
          {organization.locations.map((location) => (
            <li key={location.id} className="flex items-start justify-between gap-2 text-[11px]">
              <span className="min-w-0 break-words text-muted-foreground">
                {location.name}
                {location.city ? ` · ${location.city}` : ""}
              </span>
              {location.status && location.status !== "publicata" && (
                <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold">{location.status}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminFragmentedOrganizations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [pendingMerge, setPendingMerge] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [bulkSelections, setBulkSelections] = useState({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [bulkMessage, setBulkMessage] = useState("");

  const scan = useCallback(async () => {
    setLoading(true);
    setError("");
    setMergeResult(null);
    setPendingMerge(null);
    setBulkSelections({});
    setBulkProgress(null);
    const response = await base44.functions
      .invoke("adminFragmentedOrganizations", {})
      .catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setLoading(false);
    if (response?.data?.error) {
      setError(response.data.error);
      return;
    }
    setResult(response?.data || null);
  }, []);

  const runMerge = useCallback(async () => {
    if (!pendingMerge) return;
    setMerging(true);
    setError("");
    const { sourceId, targetId } = pendingMerge;
    const response = await base44.functions
      .invoke("adminFragmentedOrganizations", {
        action: "merge",
        source_organization_id: sourceId,
        target_organization_id: targetId,
        confirmation: `MERGE ${sourceId.slice(0, 8)} ${targetId.slice(0, 8)}`,
      })
      .catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setMerging(false);
    setPendingMerge(null);
    if (response?.data?.error) {
      setError(response.data.error);
      return;
    }
    setMergeResult(response?.data || null);
    await scan();
  }, [pendingMerge, scan]);

  const safePairs = useMemo(() => (result?.candidate_pairs || []).filter((pair) => pair.batch_safe), [result]);
  const selectedCount = Object.keys(bulkSelections).length;

  const selectSafePairs = () => {
    const next = {};
    for (const pair of safePairs) next[pairKey(pair)] = pair.recommended_target_id;
    setBulkSelections(next);
  };

  const runBulkMerges = async () => {
    if (!result || selectedCount === 0 || bulkRunning) return;
    const selected = result.candidate_pairs
      .filter((pair) => bulkSelections[pairKey(pair)])
      .map((pair) => {
        const targetId = bulkSelections[pairKey(pair)];
        const source = pair.organizations.find((organization) => organization.id !== targetId);
        const target = pair.organizations.find((organization) => organization.id === targetId);
        return { pair, source, target };
      })
      .filter((item) => item.source && item.target);

    const confirmed = window.confirm(`Fuzioneaza ${selected.length} perechi selectate? Pentru fiecare pereche se pastreaza organizatia indicata, iar cealalta devine inactiva dupa mutarea completa a relatiilor.`);
    if (!confirmed) return;

    setBulkRunning(true);
    setError("");
    setBulkMessage("");
    let merged = 0;
    let failed = 0;
    setBulkProgress({ done: 0, total: selected.length, merged: 0, failed: 0 });

    for (let index = 0; index < selected.length; index += 1) {
      const { source, target } = selected[index];
      const response = await base44.functions
        .invoke("adminFragmentedOrganizations", {
          action: "merge",
          source_organization_id: source.id,
          target_organization_id: target.id,
          confirmation: `MERGE ${source.id.slice(0, 8)} ${target.id.slice(0, 8)}`,
        })
        .catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));

      if (response?.data?.error || response?.data?.source_deactivated === false) failed += 1;
      else merged += 1;
      setBulkProgress({ done: index + 1, total: selected.length, merged, failed });
    }

    setBulkMessage(`Lot finalizat: ${merged} fuziuni complete, ${failed} cazuri nefinalizate. Cazurile nefinalizate au ramas active si pot fi reverificate.`);
    setBulkRunning(false);
    await scan();
  };

  return (
    <AdminCard className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Organizatii fragmentate</h3>
          <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Scanarea cauta perechi candidate. Fuziunea in lot este permisa automat doar pentru perechi cu dovada de operator juridic comun sau acelasi brand exact pe acelasi site, fara conflict juridic.
          </p>
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={loading || bulkRunning}
          className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
        >
          {loading ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
          {loading ? "Se scaneaza..." : "Scaneaza directorul"}
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {mergeResult && (
        <div role="status" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <div className="text-xs font-semibold text-emerald-900">
            Fuziune finalizata: {mergeResult.moved_count} {mergeResult.moved_count === 1 ? "locatie mutata" : "locatii mutate"}
            {mergeResult.related_moved?.ProviderMembership > 0 ? `, ${mergeResult.related_moved.ProviderMembership} membri` : ""}
            {mergeResult.related_moved?.ProviderWorkspaceSubmission > 0 ? `, ${mergeResult.related_moved.ProviderWorkspaceSubmission} cereri` : ""}
            {mergeResult.source_deactivated ? ", organizatia sursa dezactivata" : ""}.
          </div>
          {mergeResult.warning && <div className="mt-1 text-[11px] font-semibold text-amber-800">{mergeResult.warning}</div>}
        </div>
      )}

      {!error && !result && !loading && (
        <EmptyState title="Nicio scanare rulata" subtitle="Apasa Scaneaza directorul pentru a cauta organizatii duplicate." />
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-auto text-xs text-muted-foreground">
                {result.scanned_organizations} organizatii verificate · <strong className="text-foreground">{result.total_found}</strong> perechi candidate · <strong className="text-foreground">{safePairs.length}</strong> eligibile pentru lot sigur
              </div>
              <button type="button" onClick={selectSafePairs} disabled={bulkRunning || safePairs.length === 0} className="h-9 rounded-full border border-border bg-background px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
                Selecteaza duplicate sigure ({safePairs.length})
              </button>
              <button type="button" onClick={() => setBulkSelections({})} disabled={bulkRunning || selectedCount === 0} className="h-9 rounded-full border border-border bg-background px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
                Goleste selectia
              </button>
              <button type="button" onClick={runBulkMerges} disabled={bulkRunning || selectedCount === 0} className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50">
                {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {bulkRunning ? "Se fuzioneaza..." : `Fuzioneaza selectate (${selectedCount})`}
              </button>
            </div>
            {bulkProgress && <div className="mt-2 text-xs text-muted-foreground">Procesate {bulkProgress.done}/{bulkProgress.total} · fuzionate {bulkProgress.merged} · nefinalizate {bulkProgress.failed}</div>}
            {bulkMessage && <div className="mt-2 rounded-xl border border-border bg-background px-3 py-2 text-xs">{bulkMessage}</div>}
          </div>

          {result.candidate_pairs.length === 0 ? (
            <EmptyState title="Nicio pereche gasita" subtitle="Directorul nu contine organizatii duplicate detectabile." />
          ) : (
            <ul className="space-y-3">
              {result.candidate_pairs.map((pair) => {
                const tone = scoreTone(pair.score);
                const key = pairKey(pair);
                const pairIds = [pair.organizations[0].id, pair.organizations[1].id];
                const isPending = Boolean(pendingMerge) && pairIds.includes(pendingMerge.sourceId) && pairIds.includes(pendingMerge.targetId);
                const selectedTarget = bulkSelections[key] || "";
                return (
                  <li key={key} className="rounded-2xl border border-border bg-secondary/20 p-3">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      {pair.batch_safe && (
                        <input
                          type="checkbox"
                          checked={Boolean(selectedTarget)}
                          onChange={(event) => setBulkSelections((current) => {
                            const next = { ...current };
                            if (event.target.checked) next[key] = pair.recommended_target_id;
                            else delete next[key];
                            return next;
                          })}
                          className="h-4 w-4 rounded border-border"
                          aria-label="Selecteaza perechea pentru fuziune in lot"
                        />
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.className}`}>{tone.label}</span>
                      <span className="text-[11px] text-muted-foreground">{pair.reason}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pair.batch_safe ? "bg-emerald-100 text-emerald-800" : pair.legal_conflict ? "bg-red-100 text-red-800" : "bg-secondary text-muted-foreground"}`}>
                        {pair.batch_reason}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <OrganizationColumn organization={pair.organizations[0]} />
                      <OrganizationColumn organization={pair.organizations[1]} />
                    </div>

                    {pair.shared_addresses?.length > 0 && (
                      <div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
                        <div className="text-[11px] font-bold text-amber-900">Adresa identica in ambele organizatii - indiciu puternic, dar nu suficient singur pentru lot automat</div>
                        <ul className="mt-1 space-y-0.5">
                          {pair.shared_addresses.map((address) => <li key={address} className="break-words text-[11px] text-amber-900/80">{address}</li>)}
                        </ul>
                      </div>
                    )}

                    {pair.batch_safe && selectedTarget && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <span className="text-[11px] font-semibold text-emerald-900">In lot se pastreaza:</span>
                        <select
                          value={selectedTarget}
                          onChange={(event) => setBulkSelections((current) => ({ ...current, [key]: event.target.value }))}
                          className="h-8 max-w-full rounded-lg border border-emerald-300 bg-white px-2 text-[11px] font-semibold text-emerald-950"
                        >
                          {pair.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                        </select>
                      </div>
                    )}

                    {isPending ? (
                      <div className="mt-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-900">
                          Confirmi fuziunea? Locatiile din "{pendingMerge.sourceName}" se muta sub "{pendingMerge.targetName}", iar prima devine inactiva doar daca toate relatiile au fost mutate.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={runMerge} disabled={merging || bulkRunning} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background disabled:opacity-60">
                            {merging ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
                            {merging ? "Se fuzioneaza..." : "Da, fuzioneaza"}
                          </button>
                          <button type="button" onClick={() => setPendingMerge(null)} disabled={merging} className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60">Renunta</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">Fuziune manuala, pastreaza:</span>
                        {pair.organizations.map((target, index) => {
                          const source = pair.organizations[index === 0 ? 1 : 0];
                          return (
                            <button
                              key={target.id}
                              type="button"
                              onClick={() => setPendingMerge({ sourceId: source.id, targetId: target.id, sourceName: source.name, targetName: target.name })}
                              disabled={bulkRunning}
                              className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50"
                            >
                              {target.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </AdminCard>
  );
}
