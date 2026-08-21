// Organizatii fragmentate (2026-08-19): scanare proactiva a directorului, pentru a
// gasi aceeasi firma inregistrata ca doua organizatii diferite. Verificat pe date
// reale - exista cazuri cu nume identic si aceeasi adresa, sub organizatii separate.
// Ecranul NU fuzioneaza nimic: prezinta perechile cu dovezi, pentru decizie de admin.
import React, { useCallback, useState } from "react";
import { AlertTriangle, Building2, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

function scoreTone(score) {
  if (score >= 95) return { label: "Duplicat aproape sigur", className: "bg-destructive/10 text-destructive" };
  if (score >= 90) return { label: "Foarte probabil duplicat", className: "bg-amber-100 text-amber-800" };
  return { label: "De verificat", className: "bg-secondary text-muted-foreground" };
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
      <div className="mt-2 text-[11px] font-semibold text-muted-foreground">
        {organization.location_count} {organization.location_count === 1 ? "locatie" : "locatii"}
      </div>
      {organization.locations?.length > 0 && (
        <ul className="mt-1.5 space-y-1">
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
  // Fuziunea cere doua actiuni separate: alegi directia, apoi confirmi. Fara pasul
  // de confirmare, un clic gresit ar muta locatii reale in productie.
  const [pendingMerge, setPendingMerge] = useState(null);
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError("");
    setMergeResult(null);
    setPendingMerge(null);
    const response = await base44.functions
      .invoke("findFragmentedOrganizations", {})
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
      .invoke("findFragmentedOrganizations", {
        action: "merge",
        source_organization_id: sourceId,
        target_organization_id: targetId,
        // Acelasi format pe care il asteapta backendul.
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

  return (
    <AdminCard className="p-4">
      {/* AdminCard primeste doar children (verificat semnatura reala), deci antetul
          il construim aici, in acelasi registru cu celelalte ecrane de sistem. */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Organizatii fragmentate</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Aceeasi firma inregistrata ca doua organizatii diferite. Scanarea nu modifica nimic - propune perechi pentru verificare.
          </p>
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={loading}
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
            Fuziune finalizată: {mergeResult.moved_count} {mergeResult.moved_count === 1 ? "locație mutată" : "locații mutate"}
            {mergeResult.related_moved?.ProviderMembership > 0 ? `, ${mergeResult.related_moved.ProviderMembership} membri` : ""}
            {mergeResult.related_moved?.ProviderWorkspaceSubmission > 0 ? `, ${mergeResult.related_moved.ProviderWorkspaceSubmission} cereri` : ""}
            {mergeResult.source_deactivated ? ", organizația sursa dezactivată" : ""}.
          </div>
          {mergeResult.warning && (
            <div className="mt-1 text-[11px] font-semibold text-amber-800">{mergeResult.warning}</div>
          )}
        </div>
      )}

      {!error && !result && !loading && (
        <EmptyState
          title="Nicio scanare rulata"
          subtitle="Apasa „Scaneaza directorul” pentru a cauta organizatii duplicate."
        />
      )}

      {result && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            {result.scanned_organizations} organizatii verificate ·{" "}
            <strong className="text-foreground">{result.total_found}</strong>{" "}
            {result.total_found === 1 ? "pereche candidata" : "perechi candidate"}
            {result.truncated ? ` (se afiseaza primele ${result.candidate_pairs.length})` : ""}
          </div>

          {result.candidate_pairs.length === 0 ? (
            <EmptyState title="Nicio pereche gasita" subtitle="Directorul nu contine organizatii duplicate detectabile." />
          ) : (
            <ul className="space-y-3">
              {result.candidate_pairs.map((pair) => {
                const tone = scoreTone(pair.score);
                const pairIds = [pair.organizations[0].id, pair.organizations[1].id];
                const isPending = Boolean(pendingMerge)
                  && pairIds.includes(pendingMerge.sourceId)
                  && pairIds.includes(pendingMerge.targetId);
                return (
                  <li key={`${pair.organizations[0].id}-${pair.organizations[1].id}`} className="rounded-2xl border border-border bg-secondary/20 p-3">
                    <div className="mb-2.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.className}`}>{tone.label}</span>
                      <span className="text-[11px] text-muted-foreground">{pair.reason}</span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <OrganizationColumn organization={pair.organizations[0]} />
                      <OrganizationColumn organization={pair.organizations[1]} />
                    </div>
                    {pair.shared_addresses?.length > 0 && (
                      <div className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
                        <div className="text-[11px] font-bold text-destructive">
                          Adresa identica in ambele organizatii - duplicat aproape cert
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {pair.shared_addresses.map((address) => (
                            <li key={address} className="break-words text-[11px] text-destructive/90">{address}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Fuziune: alegi ce organizatie ramane. Locatiile celeilalte se
                        muta sub ea, iar cealalta devine inactiva (NU se sterge). */}
                    {isPending ? (
                      <div className="mt-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-900">
                          Confirmi fuziunea? Locatiile din „{pendingMerge.sourceName}” se mută sub „{pendingMerge.targetName}”, iar prima devine inactivă.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={runMerge}
                            disabled={merging}
                            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-foreground px-3.5 text-xs font-semibold text-background disabled:opacity-60"
                          >
                            {merging ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : null}
                            {merging ? "Se fuzionează..." : "Da, fuzionează"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingMerge(null)}
                            disabled={merging}
                            className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                          >
                            Renunță
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground">Fuzionează, păstrând:</span>
                        <button
                          type="button"
                          onClick={() => setPendingMerge({
                            sourceId: pair.organizations[1].id,
                            targetId: pair.organizations[0].id,
                            sourceName: pair.organizations[1].name,
                            targetName: pair.organizations[0].name,
                          })}
                          className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-[11px] font-semibold hover:bg-secondary"
                        >
                          {pair.organizations[0].name}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingMerge({
                            sourceId: pair.organizations[0].id,
                            targetId: pair.organizations[1].id,
                            sourceName: pair.organizations[0].name,
                            targetName: pair.organizations[1].name,
                          })}
                          className="inline-flex min-h-9 items-center rounded-full border border-border bg-background px-3 text-[11px] font-semibold hover:bg-secondary"
                        >
                          {pair.organizations[1].name}
                        </button>
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
