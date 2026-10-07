import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import { daysLabel } from "@/lib/adminFormat";
import { getCanonicalServiceDefinition } from "@/lib/canonicalServiceCatalog";

const serviceLabel = (key) => {
  if (!key) return "Fără serviciu precizat";
  const def = getCanonicalServiceDefinition(key);
  return def?.label || def?.name || key;
};

function ListCard({ title, subtitle, rows, failed, empty, renderLabel }) {
  return (
    <AdminCard className="p-5">
      <h3 className="font-heading text-sm font-bold">{title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {failed && <p className="text-sm text-muted-foreground">Indisponibil momentan.</p>}
      {!failed && !rows && <AdminLoading label={`Se încarcă: ${title}`} rows={2} />}
      {!failed && rows && rows.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      {!failed && rows && rows.length > 0 && (
        <ul className="divide-y divide-border text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{renderLabel(r)}</span>
              <span className="font-semibold tabular-nums">{r.count.toLocaleString("ro-RO")}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

export default function SearchInsightsCards({ data, days, failed = false }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ListCard
        title="Ce caută pacienții"
        subtitle={`Cele mai căutate servicii (${daysLabel(days)}).`}
        rows={data?.top_services}
        failed={failed}
        empty="Încă nu sunt căutări înregistrate în această perioadă."
        renderLabel={(r) => serviceLabel(r.service_key)}
      />
      <ListCard
        title="Cerere fără ofertă"
        subtitle={`Căutări fără niciun rezultat, pe județ și serviciu (${daysLabel(days)}).`}
        rows={data?.zero_results}
        failed={failed}
        empty="Nicio căutare fără rezultat în această perioadă."
        renderLabel={(r) => `${r.county || "Județ necunoscut"} · ${serviceLabel(r.service_key)}`}
      />
    </div>
  );
}
