import React, { useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { daysLabel } from "@/lib/adminFormat";

const fmt = (n) => n.toLocaleString("ro-RO");

// Sub acest număr de locații publicate, un județ e slab acoperit. Cu căutări și puține locații, e candidat de research.
export const LOW_COVERAGE = 10;
export const needsResearch = (row) => row.searches > 0 && row.locations < LOW_COVERAGE;

export default function CountyCoverageCard({ rows, failed, days }) {
  const [filter, setFilter] = useState("all");
  const candidates = (rows || []).filter(needsResearch);
  const shown = filter === "research" ? candidates : rows || [];

  return (
    <AdminCard className="p-5">
      <div className="flex items-center gap-1">
        <h3 className="font-heading text-sm font-bold">Acoperire pe județe</h3>
        <AdminHint label="Despre acoperirea pe județe">
          Locații publicate (acum), căutări ({daysLabel(days)}) și pacienți care și-au lăsat datele. Județele cu multe căutări și
          puține locații (sub {LOW_COVERAGE}) sunt primele candidate pentru research.
        </AdminHint>
      </div>
      {failed && <p className="mt-3 text-sm text-muted-foreground">Indisponibil momentan.</p>}
      {!failed && !rows && <div className="mt-3"><AdminLoading label="Se încarcă acoperirea pe județe…" rows={2} /></div>}
      {!failed && rows && (
        <>
          <AdminChips
            className="mt-3"
            label="Filtrează județele"
            value={filter}
            onChange={setFilter}
            options={[
              { key: "all", label: "Toate", count: rows.length },
              { key: "research", label: "De cercetat", count: candidates.length },
            ]}
          />
          {shown.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {filter === "research" ? "Niciun județ cu căutări și puține locații în perioada aleasă." : "Încă nu avem date pe județe."}
            </p>
          ) : (
            <div className="mt-3 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 font-medium">Județ</th>
                    <th scope="col" className="py-2 text-right font-medium">Locații</th>
                    <th scope="col" className="py-2 text-right font-medium">Căutări</th>
                    <th scope="col" className="py-2 text-right font-medium">Contacte din căutări</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.county} className="border-t border-border">
                      <td className="py-1.5">
                        {r.county}
                        {needsResearch(r) && <StatusBadge className="ml-2" tone="warning" label="De cercetat" />}
                      </td>
                      <td className={`py-1.5 text-right font-semibold tabular-nums ${r.locations < LOW_COVERAGE ? "text-danger" : ""}`}>{fmt(r.locations)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(r.searches)}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmt(r.search_contacts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminCard>
  );
}
