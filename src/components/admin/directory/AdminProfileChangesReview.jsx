import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminPendingChanges from "@/components/admin/AdminPendingChanges";
import AdminCard from "@/components/admin/ui/AdminCard";

export default function AdminProfileChangesReview({ onCountChange }) {
  const [locations, setLocations] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const locList = await base44.entities.ProviderLocation.list("name", 500).catch(() => []);
    const pending = locList.filter((l) => !!l.pending_changes);
    setLocations(pending);
    onCountChange && onCountChange(pending.length);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (loc, decision, notes) => {
    setBusy(true);
    setError("");
    const res = await base44.functions
      .invoke("reviewProfileChanges", { location_id: loc.id, decision, notes })
      .catch((e) => ({ data: { error: e.response?.data?.error || e.message } }));
    if (res.data?.error) setError(res.data.error);
    await load();
    setBusy(false);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Se incarca modificarile...</p>;

  return (
    <AdminCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-base">Modificari de profil in review</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Aici apar modificarile trimise de furnizori: logo, nume public, adresa, servicii sau alte campuri care necesita aprobare.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{locations.length} in asteptare</span>
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-4 space-y-3">
        {locations.length === 0 && <p className="text-sm text-muted-foreground">Nu exista modificari de profil in asteptare.</p>}
        {locations.map((l) => (
          <AdminPendingChanges
            key={l.id}
            location={l}
            busy={busy}
            onDecision={review}
          />
        ))}
      </div>
    </AdminCard>
  );
}
