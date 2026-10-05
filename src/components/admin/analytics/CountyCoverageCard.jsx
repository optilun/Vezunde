import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";

const fmt = (n) => n.toLocaleString("ro-RO");

export default function CountyCoverageCard() {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    base44.functions.invoke("adminAnalyticsOps", {})
      .then((r) => setRows(r.data.counties || []))
      .catch(() => setFailed(true));
  }, []);

  return (
    <AdminCard className="p-5">
      <h3 className="font-heading text-sm font-bold">Acoperire pe județe (acum)</h3>
      <p className="mb-3 text-xs text-muted-foreground">Locații publicate și pacienți care și-au lăsat datele la căutare. Județele cu puține locații sunt primele candidate pentru research.</p>
      {failed ? (
        <p className="text-sm text-muted-foreground">Indisponibil momentan.</p>
      ) : !rows ? (
        <p className="text-sm text-muted-foreground">Se încarcă...</p>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr><th className="py-2 font-medium">Județ</th><th className="py-2 text-right font-medium">Locații</th><th className="py-2 text-right font-medium">Contacte din căutări</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.county} className="border-t">
                  <td className="py-1.5">{r.county}</td>
                  <td className={`py-1.5 text-right font-semibold ${r.locations < 10 ? "text-destructive" : ""}`}>{fmt(r.locations)}</td>
                  <td className="py-1.5 text-right">{fmt(r.search_contacts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
}