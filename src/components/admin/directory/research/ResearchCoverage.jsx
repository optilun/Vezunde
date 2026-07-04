import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { RESEARCH_STATUS_LABELS } from "@/lib/researchCatalog";
import { PCS_LABELS } from "@/lib/directoryOpsCatalog";

const box = "bg-card border border-border rounded-xl p-5";

function Stat({ label, value }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-2xl font-heading font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function CountList({ title, counts, labels }) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className={box}>
      <h3 className="font-heading font-bold text-sm">{title}</h3>
      {entries.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Fara date.</p> : (
        <ul className="mt-3 text-sm space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-4">
              <span>{labels ? (labels[k] || k) : k}</span>
              <span className="font-semibold">{v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ResearchCoverage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    base44.functions
      .invoke("researchOps", { action: "coverage" })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || err.message));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Se incarca...</p>;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total locatii" value={data.total_locations} />
        <Stat label="Fara website oficial" value={data.without_website} />
        <Stat label="Fara dovezi active" value={data.without_active_evidence} />
        <Stat label={`Neverificate recent (${data.stale_days} zile)`} value={data.not_checked_recently} />
        <Stat label="Gata de review" value={data.ready_for_review} />
        <Stat label="Respinse" value={data.rejected} />
      </div>
      <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CountList title="Locatii pe oras" counts={data.by_city} />
        <CountList title="Locatii pe judet" counts={data.by_county} />
        <CountList title="Status profil (directory/claimed/verified)" counts={data.profile_control_counts} labels={PCS_LABELS} />
        <CountList title="Status research" counts={data.research_status_counts} labels={RESEARCH_STATUS_LABELS} />
        <CountList title="Acoperire servicii generale" counts={data.general_service_coverage} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Acoperirea serviciilor este calculata doar pentru categorii generale. Capacitatea clinica nu este calculata din date neverificate.
      </p>
    </div>
  );
}