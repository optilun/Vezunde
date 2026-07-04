import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export default function GeoImportPreview({ preview }) {
  const { critical, stats } = preview;
  return (
    <div className="mt-5 border border-border rounded-xl p-4 bg-card">
      <h3 className="font-heading font-bold text-sm">Validari critice</h3>
      <ul className="mt-2 space-y-1.5">
        {critical.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {c.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />}
            <span className={c.ok ? "text-foreground" : "text-destructive"}>{c.label}</span>
          </li>
        ))}
      </ul>
      <h3 className="font-heading font-bold text-sm mt-5">Statistici preview</h3>
      <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
        <p>Total randuri: <b className="text-foreground">{stats.total_rows}</b></p>
        <p>Duplicate siruta_code: <b className="text-foreground">{stats.duplicate_count}</b></p>
        <p>Randuri invalide: <b className="text-foreground">{stats.invalid_rows}</b></p>
        <p>De creat: <b className="text-foreground">{stats.expected_create}</b> · De actualizat: <b className="text-foreground">{stats.expected_update}</b> · De dezactivat: <b className="text-foreground">{stats.expected_deactivate}</b></p>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Pe nivel SIRUTA: {Object.entries(stats.by_siruta_level).map(([k, v]) => `nivel ${k}: ${v}`).join(" · ")}</p>
      <p className="mt-1 text-xs text-muted-foreground">Pe tip: {Object.entries(stats.by_locality_type).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
      <p className="mt-1 text-xs text-muted-foreground">Bucuresti: {stats.bucharest.general || "—"} · Sectoare: {stats.bucharest.sectors.join(", ") || "—"}</p>
    </div>
  );
}