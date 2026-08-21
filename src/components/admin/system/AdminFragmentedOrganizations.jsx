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

  const scan = useCallback(async () => {
    setLoading(true);
    setError("");
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

  return (
    <AdminCard
      title="Organizatii fragmentate"
      description="Aceeasi firma inregistrata ca doua organizatii diferite. Scanarea nu modifica nimic - propune perechi pentru verificare."
      action={(
        <button
          type="button"
          onClick={scan}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-background px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
        >
          {loading ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />}
          {loading ? "Se scaneaza..." : "Scaneaza directorul"}
        </button>
      )}
    >
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {!error && !result && !loading && (
        <EmptyState
          title="Nicio scanare rulata"
          description="Apasa „Scaneaza directorul” pentru a cauta organizatii duplicate."
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
            <EmptyState title="Nicio pereche gasita" description="Directorul nu contine organizatii duplicate detectabile." />
          ) : (
            <ul className="space-y-3">
              {result.candidate_pairs.map((pair) => {
                const tone = scoreTone(pair.score);
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
