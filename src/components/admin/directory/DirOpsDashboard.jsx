import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

export default function DirOpsDashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.ProviderLocation.list(null, 500),
      base44.entities.LocationService.list(null, 2000),
      base44.entities.ProviderClaimRequest.filter({ status: "in_asteptare" }, null, 200),
    ]).then(([locs, svcs, claims]) => {
      setStats({
        locations: locs.length,
        directory: locs.filter((l) => (l.profile_control_status || "directory") === "directory").length,
        claimed: locs.filter((l) => l.profile_control_status === "claimed").length,
        verified: locs.filter((l) => l.profile_control_status === "verified").length,
        suspended: locs.filter((l) => l.profile_control_status === "suspended").length,
        migrationLocations: locs.filter((l) => l.migration_review_required === true).length,
        migrationServices: svcs.filter((s) => s.migration_review_required === true).length,
        services: svcs.length,
        confirmedServices: svcs.filter((s) => ["publicly_listed", "provider_confirmed", "vezunde_verified"].includes(s.confirmation_level)).length,
        pendingClaims: claims.length,
      });
    });
  }, []);

  if (!stats) return <p className="text-muted-foreground text-sm">Se incarca...</p>;

  const cards = [
    { label: "Locatii total", value: stats.locations, tab: "profiluri" },
    { label: "Profiluri directory", value: stats.directory, tab: "profiluri" },
    { label: "Revendicate / Verificate", value: `${stats.claimed} / ${stats.verified}`, tab: "profiluri" },
    { label: "Suspendate", value: stats.suspended, tab: "profiluri" },
    { label: "Servicii total", value: stats.services, tab: "servicii" },
    { label: "Servicii confirmate", value: stats.confirmedServices, tab: "servicii" },
    { label: "Review migrare (locatii + servicii)", value: stats.migrationLocations + stats.migrationServices, tab: "migrare" },
    { label: "Revendicari in asteptare", value: stats.pendingClaims, tab: "revendicari" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <button key={c.label} onClick={() => onNavigate(c.tab)} className="text-left bg-card border border-border rounded-lg p-4 hover:bg-accent transition-colors">
          <div className="text-2xl font-bold font-heading">{c.value}</div>
          <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
        </button>
      ))}
    </div>
  );
}