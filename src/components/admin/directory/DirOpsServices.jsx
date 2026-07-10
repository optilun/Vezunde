import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import DirOpsServiceAdd from "@/components/admin/directory/DirOpsServiceAdd";
import DirOpsServiceRow from "@/components/admin/directory/DirOpsServiceRow";
import AdminCard from "@/components/admin/ui/AdminCard";

function SummaryItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/35 px-3 py-2.5">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}

export default function DirOpsServices() {
  const [locations, setLocations] = useState([]);
  const [locationId, setLocationId] = useState("");
  const [services, setServices] = useState(null);
  const [dataMessage, setDataMessage] = useState("");
  const [backfillReport, setBackfillReport] = useState(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState("");

  const loadAdminData = async (selectedLocationId = "") => {
    setDataMessage("");
    const response = await base44.functions.invoke("getAdminServiceManagementData", {
      location_id: selectedLocationId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));

    if (response.data?.error) {
      setDataMessage(response.data.error);
      if (!selectedLocationId) setLocations([]);
      setServices(selectedLocationId ? [] : null);
      return;
    }

    setLocations(response.data?.locations || []);
    setServices(selectedLocationId ? (response.data?.services || []) : null);
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    setBackfillReport(null);
    setBackfillMessage("");
    if (locationId) loadAdminData(locationId);
    else setServices(null);
  }, [locationId]);

  const loadServices = async (id) => {
    if (!id) return;
    await loadAdminData(id);
  };

  const runDryRun = async () => {
    if (!locationId) return;
    setBackfillBusy(true);
    setBackfillMessage("");
    const response = await base44.functions.invoke("backfillLocationServiceMatching", {
      action: "dry_run",
      location_id: locationId,
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));
    setBackfillBusy(false);
    if (response.data?.error) {
      setBackfillMessage(response.data.error);
      return;
    }
    setBackfillReport(response.data);
    setBackfillMessage("Verificarea a fost finalizată. Nu au fost modificate date.");
  };

  const applyBackfill = async () => {
    const changeCount = backfillReport?.summary?.changes_required || 0;
    if (!locationId || changeCount === 0) return;
    const confirmed = window.confirm(`Aplici ${changeCount} modificări pentru serviciile acestei locații? Acțiunea va fi înregistrată în audit.`);
    if (!confirmed) return;

    setBackfillBusy(true);
    setBackfillMessage("");
    const response = await base44.functions.invoke("backfillLocationServiceMatching", {
      action: "apply",
      location_id: locationId,
      expected_change_count: changeCount,
      confirm: "APPLY_MATCHING_BACKFILL",
    }).catch((error) => ({ data: { error: error.response?.data?.error || error.message } }));

    if (response.data?.error) {
      setBackfillBusy(false);
      setBackfillMessage(response.data.error);
      return;
    }

    await loadServices(locationId);
    const verification = await base44.functions.invoke("backfillLocationServiceMatching", {
      action: "dry_run",
      location_id: locationId,
    }).catch(() => ({ data: null }));

    setBackfillBusy(false);
    setBackfillReport(verification.data || response.data);
    setBackfillMessage(`${response.data?.applied_count || 0} modificări au fost aplicate și înregistrate în audit.`);
  };

  const location = locations.find((item) => item.id === locationId);
  const summary = backfillReport?.summary;

  return (
    <div className="max-w-5xl space-y-5">
      <AdminCard className="p-5">
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Alege locația</label>
        <select className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
          <option value="">Alege...</option>
          {locations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.public_display_name || item.name} — {item.city || "fără localitate"} ({item.profile_control_status || "directory"})
            </option>
          ))}
        </select>
        {locations.length === 0 && !dataMessage && (
          <p className="mt-2 text-xs text-muted-foreground">Nu există locații disponibile în mediul de date curent.</p>
        )}
        {dataMessage && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {dataMessage}
          </div>
        )}
      </AdminCard>

      {location && (
        <>
          <AdminCard className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-sm font-bold">Eligibilitate pentru recomandări</h3>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Verifică dacă serviciile active au valoarea corectă pentru matching. Serviciile generale și tehnice confirmate pot intra în recomandări. Serviciile medicale rămân blocate până la verificarea Vezunde.
                </p>
              </div>
              <button
                type="button"
                disabled={backfillBusy}
                onClick={runDryRun}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                {backfillBusy ? "Se verifică..." : "Rulează verificarea"}
              </button>
            </div>

            {summary && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <SummaryItem label="Servicii analizate" value={summary.total_services} />
                  <SummaryItem label="Modificări necesare" value={summary.changes_required} />
                  <SummaryItem label="De activat" value={summary.enable_count} />
                  <SummaryItem label="De dezactivat" value={summary.disable_count} />
                  <SummaryItem label="Fără schimbări" value={summary.unchanged_count} />
                </div>

                {summary.changes_required > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs leading-relaxed text-amber-900">
                      Verificarea este doar o simulare. Aplicarea modifică exclusiv câmpul <code>matching_allowed</code> și scrie fiecare schimbare în audit.
                    </p>
                    <button
                      type="button"
                      disabled={backfillBusy}
                      onClick={applyBackfill}
                      className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
                    >
                      Aplică {summary.changes_required} modificări
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">
                    Serviciile acestei locații au deja setările corecte pentru matching.
                  </div>
                )}

                <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-secondary/55 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Serviciu</th>
                        <th className="px-3 py-2.5 font-semibold">Nivel</th>
                        <th className="px-3 py-2.5 font-semibold">Confirmare</th>
                        <th className="px-3 py-2.5 font-semibold">Actual</th>
                        <th className="px-3 py-2.5 font-semibold">Propus</th>
                        <th className="px-3 py-2.5 font-semibold">Motiv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(backfillReport.rows || []).map((row) => (
                        <tr key={row.id} className={row.change_required ? "bg-amber-50/35" : "bg-card"}>
                          <td className="px-3 py-2.5 font-medium">{row.service_key}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.service_need_level}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{row.confirmation_level}</td>
                          <td className="px-3 py-2.5">{row.matching_allowed_old ? "Activ" : "Inactiv"}</td>
                          <td className="px-3 py-2.5 font-semibold">{row.matching_allowed_proposed ? "Activ" : "Inactiv"}</td>
                          <td className="max-w-sm px-3 py-2.5 text-muted-foreground">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {backfillMessage && <p className="mt-3 text-xs text-muted-foreground">{backfillMessage}</p>}
          </AdminCard>

          <AdminCard className="p-5">
            <h3 className="font-heading text-sm font-bold">Servicii existente</h3>
            <div className="mt-3 space-y-2">
              {services === null && <p className="text-sm text-muted-foreground">Se încarcă...</p>}
              {services && services.length === 0 && <p className="text-sm text-muted-foreground">Niciun serviciu înregistrat.</p>}
              {services && services.map((service) => (
                <DirOpsServiceRow key={service.id} service={service} location={location} onChanged={() => loadServices(locationId)} />
              ))}
            </div>
          </AdminCard>

          <AdminCard className="p-5">
            <h3 className="font-heading text-sm font-bold">Adaugă serviciu din catalogul aprobat</h3>
            <div className="mt-3">
              <DirOpsServiceAdd location={location} onAdded={() => loadServices(locationId)} />
            </div>
          </AdminCard>
        </>
      )}
    </div>
  );
}
