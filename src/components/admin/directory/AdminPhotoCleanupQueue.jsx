import React, { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, ImageOff, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

export default function AdminPhotoCleanupQueue() {
  const [assets, setAssets] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const response = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
      action: "admin_cleanup_list",
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message, assets: [] },
    }));
    if (response.data?.error) setError(response.data.error);
    setAssets(response.data?.assets || []);
  };

  useEffect(() => { load(); }, []);

  const markCleaned = async (asset) => {
    setBusyId(asset.id);
    setError("");
    const response = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
      action: "mark_cleanup_complete",
      asset_id: asset.id,
      note: "Fisier verificat si eliminat din stocarea media sau confirmat ca indisponibil.",
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setBusyId("");
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    await load();
  };

  if (!assets) return <p className="text-sm text-muted-foreground">Se incarca fisierele nefolosite...</p>;

  return (
    <AdminCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-bold">Curatare fotografii nefolosite</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Aici apar fisierele retrase sau inlocuite. Sterge fisierul din biblioteca media Base44, apoi confirma finalizarea pentru a inchide intrarea de audit.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{assets.length} in asteptare</span>
      </div>

      {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>}

      <div className="mt-5 space-y-3">
        {assets.length === 0 ? (
          <EmptyState icon={ImageOff} title="Nu exista fotografii de curatat" subtitle="Fisierele retrase sau inlocuite vor aparea aici." />
        ) : assets.map((asset) => (
          <article key={asset.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold">Fotografie locatie</div>
                <div className="mt-1 text-xs text-muted-foreground">Locatie: {asset.location_id || "-"}</div>
                <div className="mt-1 text-xs text-muted-foreground">Motiv: {asset.cleanup_reason || "fisier nefolosit"}</div>
                {asset.cleanup_requested_at && <div className="mt-1 text-xs text-muted-foreground">Adaugat: {new Date(asset.cleanup_requested_at).toLocaleString("ro-RO")}</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                {asset.storage_reference && (
                  <a href={asset.storage_reference} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary">
                    Deschide fisierul <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button type="button" disabled={busyId === asset.id} onClick={() => markCleaned(asset)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40">
                  {busyId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Marcheaza curatat
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AdminCard>
  );
}
