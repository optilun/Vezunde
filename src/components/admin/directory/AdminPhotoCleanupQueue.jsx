import React, { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, ImageOff, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { fetchByIds } from "@/lib/adminEntityBatch";
import { fullDateTime, oldestFirst, relativeTime } from "@/lib/adminFormat";
import { mediaCleanupReasonLabel } from "@/lib/adminLabels";

function Thumbnail({ url }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/40 text-muted-foreground" title="Fișierul nu se mai poate afișa">
        <ImageOff className="h-5 w-5" aria-hidden="true" />
      </div>
    );
  }
  return <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover" />;
}

export default function AdminPhotoCleanupQueue() {
  const { refresh: refreshCounts } = useAdminCounts();
  const [assets, setAssets] = useState(null);
  const [locations, setLocations] = useState({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  const load = async () => {
    setError("");
    const response = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
      action: "admin_cleanup_list",
    }).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message, assets: [] },
    }));
    if (response.data?.error) setError(response.data.error);
    const rows = oldestFirst(response.data?.assets || [], (asset) => asset.cleanup_requested_at || asset.created_date);
    const { byId } = await fetchByIds(base44.entities.ProviderLocation, rows.map((asset) => asset.location_id));
    setLocations(byId);
    setAssets(rows);
  };

  useEffect(() => { load(); }, []);

  const markCleaned = async (asset) => {
    setBusyId(asset.id);
    setError("");
    const response = await base44.functions.invoke("providerPhotoUploadLifecycleOps", {
      action: "mark_cleanup_complete",
      asset_id: asset.id,
      note: "Fișier verificat și eliminat din stocarea media sau confirmat ca indisponibil.",
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setBusyId("");
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setAssets((current) => (current || []).filter((entry) => entry.id !== asset.id));
    setFlash("Marcat ca curățat.");
    refreshCounts();
    load().catch(() => {});
  };

  if (!assets) return <AdminLoading label="Se încarcă fișierele nefolosite…" />;

  return (
    <AdminCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="font-heading text-base font-bold">Fotografii nefolosite</h2>
          <AdminHint label="Cum se curăță">
            Apar fișierele retrase sau înlocuite. Șterge fișierul din biblioteca media Base44, apoi apasă „Marchează curățat” ca să închizi intrarea din istoric.
          </AdminHint>
        </div>
        <StatusBadge label={`${assets.length} în așteptare`} />
      </div>

      {error && <AdminNotice tone="danger" className="mt-4">{error}</AdminNotice>}
      {flash && <AdminNotice tone="success" className="mt-4" onDismiss={() => setFlash("")}>{flash}</AdminNotice>}

      <div className="mt-4 space-y-3">
        {assets.length === 0 ? (
          <EmptyState icon={ImageOff} title="Nu există fotografii de curățat." subtitle="Fișierele retrase sau înlocuite vor apărea aici." />
        ) : assets.map((asset) => {
          const location = locations[asset.location_id];
          const where = location
            ? [location.public_display_name || location.name, location.city].filter(Boolean).join(", ")
            : asset.location_id || "Locație necunoscută";
          return (
            <article key={asset.id} className="rounded-2xl border border-border bg-card p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Thumbnail url={asset.storage_reference} />
                <div className="min-w-0 flex-1">
                  <div className="break-words text-sm font-bold">{where}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{mediaCleanupReasonLabel(asset.cleanup_reason)}</div>
                  {asset.cleanup_requested_at && (
                    <div className="mt-0.5 text-xs text-muted-foreground" title={fullDateTime(asset.cleanup_requested_at)}>
                      Adăugat {relativeTime(asset.cleanup_requested_at)}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {asset.storage_reference && (
                    <a
                      href={asset.storage_reference}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary sm:min-h-10"
                    >
                      Deschide fișierul <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={busyId === asset.id}
                    onClick={() => markCleaned(asset)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-40 sm:min-h-10"
                  >
                    {busyId === asset.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    Marchează curățat
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </AdminCard>
  );
}
