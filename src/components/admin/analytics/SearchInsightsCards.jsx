import React from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import { getCanonicalServiceDefinition } from "@/lib/canonicalServiceCatalog";

const serviceLabel = (key) => {
  if (!key) return "Fără serviciu precizat";
  const def = getCanonicalServiceDefinition(key);
  return def?.label || def?.name || key;
};

function ListCard({ title, subtitle, rows, empty, renderLabel }) {
  return (
    <AdminCard className="p-5">
      <h3 className="font-heading text-sm font-bold">{title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {!rows ? (
        <p className="text-sm text-muted-foreground">Se încarcă...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">{renderLabel(r)}</span>
              <span className="font-semibold">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

export default function SearchInsightsCards({ data, days }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ListCard
        title="Ce caută pacienții"
        subtitle={`Cele mai căutate servicii (${days} zile).`}
        rows={data?.top_services}
        empty="Încă nu sunt căutări înregistrate în această perioadă."
        renderLabel={(r) => serviceLabel(r.service_key)}
      />
      <ListCard
        title="Cerere fără ofertă"
        subtitle={`Căutări fără niciun rezultat, pe județ și serviciu (${days} zile).`}
        rows={data?.zero_results}
        empty="Nicio căutare fără rezultat în această perioadă."
        renderLabel={(r) => `${r.county || "Județ necunoscut"} · ${serviceLabel(r.service_key)}`}
      />
    </div>
  );
}