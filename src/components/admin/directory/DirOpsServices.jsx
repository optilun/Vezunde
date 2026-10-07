import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DirOpsServiceAdd from "@/components/admin/directory/DirOpsServiceAdd";
import DirOpsServiceRow from "@/components/admin/directory/DirOpsServiceRow";
import AdminCard from "@/components/admin/ui/AdminCard";
import { useAdminConfirm } from "@/components/admin/ui/AdminConfirm";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminLocationPicker from "@/components/admin/ui/AdminLocationPicker";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminSelectedId } from "@/components/admin/useAdminRoute";
import { profileControlLabel, serviceNeedLevelLabel } from "@/lib/adminLabels";
import { CONFIRMATION_LABELS } from "@/lib/directoryOpsCatalog";
import { getServiceLabel } from "@/lib/serviceAutocomplete";

const errorOf = (error) => error?.response?.data?.error || error?.message || "A apărut o eroare.";

export default function DirOpsServices() {
  const confirm = useAdminConfirm();
  const [selectedId, setSelectedId] = useAdminSelectedId();
  const [locations, setLocations] = useState(null);
  const [counts, setCounts] = useState(null);
  const [services, setServices] = useState(null);
  const [error, setError] = useState("");
  const [backfillReport, setBackfillReport] = useState(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState("");

  // Doar ultimul răspuns contează: dacă schimbi repede locația, un răspuns întârziat nu îl suprascrie pe cel nou.
  const loadSeq = useRef(0);
  const loadAdminData = useCallback(async (locationId = "") => {
    setError("");
    const seq = ++loadSeq.current;
    const response = await base44.functions.invoke("getAdminServiceManagementData", {
      location_id: locationId,
    }).catch((requestError) => ({ data: { error: errorOf(requestError) } }));
    if (seq !== loadSeq.current) return;

    if (response.data?.error) {
      setError(response.data.error);
      if (!locationId) setLocations([]);
      setServices(locationId ? [] : null);
      return;
    }
    setLocations(response.data?.locations || []);
    setServices(locationId ? (response.data?.services || []) : null);
  }, []);

  // Câte servicii are fiecare locație (doar ca să poți filtra „doar cu servicii”); dacă nu merge, lista rămâne fără numere.
  const loadCounts = useCallback(async () => {
    try {
      const rows = await base44.entities.LocationService.list("location_id", 3000, 0, ["location_id"]);
      const next = {};
      for (const row of rows || []) next[row.location_id] = (next[row.location_id] || 0) + 1;
      setCounts(next);
    } catch {
      setCounts(null);
    }
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  // O singură încărcare: lista locațiilor vine la fiecare apel, iar serviciile doar când e aleasă o locație
  // (înainte, o a doua cerere „fără locație” putea sosi ultima și golea lista de servicii).
  useEffect(() => {
    setBackfillReport(null);
    setBackfillMessage("");
    setServices(null);
    loadAdminData(selectedId);
  }, [selectedId, loadAdminData]);

  const reloadServices = async () => {
    if (!selectedId) return;
    await loadAdminData(selectedId);
    loadCounts();
  };

  const runDryRun = async () => {
    if (!selectedId) return;
    setBackfillBusy(true);
    setBackfillMessage("");
    const response = await base44.functions.invoke("backfillLocationServiceMatching", {
      action: "dry_run",
      location_id: selectedId,
    }).catch((requestError) => ({ data: { error: errorOf(requestError) } }));
    setBackfillBusy(false);
    if (response.data?.error) {
      setBackfillMessage(response.data.error);
      return;
    }
    setBackfillReport(response.data);
    setBackfillMessage("");
  };

  const applyBackfill = async () => {
    const changeCount = backfillReport?.summary?.changes_required || 0;
    if (!selectedId || changeCount === 0) return;
    const confirmed = await confirm({
      title: `Aplici ${changeCount} ${changeCount === 1 ? "modificare" : "modificări"}?`,
      description: "Se schimbă doar eligibilitatea pentru recomandări a serviciilor acestei locații. Acțiunea apare în Istoric audit.",
      confirmLabel: "Aplică",
    });
    if (!confirmed) return;

    setBackfillBusy(true);
    setBackfillMessage("");
    const response = await base44.functions.invoke("backfillLocationServiceMatching", {
      action: "apply",
      location_id: selectedId,
      expected_change_count: changeCount,
      confirm: "APPLY_MATCHING_BACKFILL",
    }).catch((requestError) => ({ data: { error: errorOf(requestError) } }));

    if (response.data?.error) {
      setBackfillBusy(false);
      setBackfillMessage(response.data.error);
      return;
    }

    await reloadServices();
    const verification = await base44.functions.invoke("backfillLocationServiceMatching", {
      action: "dry_run",
      location_id: selectedId,
    }).catch(() => ({ data: null }));

    setBackfillBusy(false);
    setBackfillReport(verification.data || response.data);
    const applied = response.data?.applied_count || 0;
    setBackfillMessage(applied === 1
      ? "1 modificare aplicată și înregistrată în Istoric audit."
      : `${applied} modificări aplicate și înregistrate în Istoric audit.`);
  };

  const location = useMemo(() => (locations || []).find((item) => item.id === selectedId) || null, [locations, selectedId]);
  const summary = backfillReport?.summary;
  const unknownSelection = Boolean(selectedId) && locations !== null && !location;

  return (
    <div className="max-w-5xl space-y-4">
      <AdminCard className="p-4 sm:p-5">
        <AdminLocationPicker
          locations={locations}
          value={selectedId}
          onChange={setSelectedId}
          counts={counts}
          label="Alege locația"
          placeholder="Caută o locație după nume sau oraș"
        />
        {locations && locations.length === 0 && !error && (
          <p className="mt-2 text-xs text-muted-foreground">Nu există locații în mediul de date curent.</p>
        )}
        {error && <AdminNotice tone="danger" className="mt-3">{error}</AdminNotice>}
        {unknownSelection && !error && (
          <AdminNotice tone="warning" className="mt-3">Locația din adresă nu a fost găsită. Alege alta din listă.</AdminNotice>
        )}
      </AdminCard>

      {!locations && <AdminLoading label="Se încarcă locațiile…" rows={2} />}

      {locations && !location && !unknownSelection && (
        <AdminCard className="p-5">
          <EmptyState icon={Wrench} title="Alege o locație." subtitle="Vezi și administrezi serviciile ei și verifici dacă pot intra în recomandări." />
        </AdminCard>
      )}

      {location && (
        <>
          <AdminCard className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words font-heading text-base font-bold">{location.public_display_name || location.name}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[location.city, location.county && location.county !== location.city ? location.county : ""].filter(Boolean).join(", ") || "fără localitate"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={profileControlLabel(location.profile_control_status)} />
                {location.status === "publicata" && (
                  <Link
                    to={`/furnizor/${location.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-secondary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Vezi pe site
                  </Link>
                )}
              </div>
            </div>
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            <div className="flex items-center gap-1.5">
              <h3 className="font-heading text-sm font-bold">
                Servicii{services ? ` (${services.length})` : ""}
              </h3>
              <AdminHint label="Cum se confirmă un serviciu">
                Nivelul arată cât de sigur e serviciul: neconfirmat → listat public (cu sursă oficială) → confirmat de furnizor → verificat VIASEE. Doar serviciile generale și tehnice confirmate pot intra în recomandări; cele medicale rămân blocate până la verificarea VIASEE.
              </AdminHint>
            </div>
            <div className="mt-3 space-y-2">
              {services === null && <AdminLoading label="Se încarcă serviciile…" rows={2} />}
              {services && services.length === 0 && (
                <p className="text-sm text-muted-foreground">Niciun serviciu înregistrat pentru această locație.</p>
              )}
              {services && services.map((service) => (
                <DirOpsServiceRow key={service.id} service={service} onChanged={reloadServices} />
              ))}
            </div>
          </AdminCard>

          <AdminCard className="p-0">
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="font-heading text-sm font-bold">Adaugă un serviciu din catalog</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-border px-4 pb-4 sm:px-5">
                <DirOpsServiceAdd location={location} onAdded={reloadServices} />
              </div>
            </details>
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading text-sm font-bold">Eligibilitate pentru recomandări</h3>
                <AdminHint label="Ce face verificarea">
                  Verifică dacă serviciile active au valoarea corectă pentru recomandări. Serviciile generale și tehnice confirmate pot intra în recomandări; cele medicale rămân blocate până la verificarea VIASEE. Verificarea doar simulează; nimic nu se schimbă până nu apeși „Aplică”.
                </AdminHint>
              </div>
              <button
                type="button"
                disabled={backfillBusy}
                onClick={runDryRun}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50 sm:min-h-10"
              >
                {backfillBusy ? "Se verifică…" : "Rulează verificarea"}
              </button>
            </div>

            {summary && (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusBadge label={`Analizate: ${summary.total_services}`} />
                  <StatusBadge label={`De activat: ${summary.enable_count}`} tone={summary.enable_count > 0 ? "info" : "neutral"} />
                  <StatusBadge label={`De dezactivat: ${summary.disable_count}`} tone={summary.disable_count > 0 ? "warning" : "neutral"} />
                  <StatusBadge label={`Fără schimbări: ${summary.unchanged_count}`} />
                </div>

                {summary.changes_required > 0 ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning-border bg-warning-soft px-4 py-3">
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-warning">
                      Se schimbă doar eligibilitatea pentru recomandări; fiecare modificare apare în Istoric audit.
                    </p>
                    <button
                      type="button"
                      disabled={backfillBusy}
                      onClick={applyBackfill}
                      className="inline-flex min-h-11 items-center rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50 sm:min-h-10"
                    >
                      Aplică {summary.changes_required} {summary.changes_required === 1 ? "modificare" : "modificări"}
                    </button>
                  </div>
                ) : (
                  <AdminNotice tone="success" className="mt-4">
                    Serviciile acestei locații au deja setările corecte pentru recomandări.
                  </AdminNotice>
                )}

                <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-secondary/55 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Serviciu</th>
                        <th className="px-3 py-2.5 font-semibold">Nivel</th>
                        <th className="px-3 py-2.5 font-semibold">Confirmare</th>
                        <th className="px-3 py-2.5 font-semibold">Acum</th>
                        <th className="px-3 py-2.5 font-semibold">Propus</th>
                        <th className="px-3 py-2.5 font-semibold">Motiv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(backfillReport.rows || []).map((row) => (
                        <tr key={row.id} className={row.change_required ? "bg-warning-soft/50" : "bg-card"}>
                          <td className="px-3 py-2.5 font-medium">{getServiceLabel(row.service_key)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{serviceNeedLevelLabel(row.service_need_level)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{CONFIRMATION_LABELS[row.confirmation_level] || row.confirmation_level}</td>
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

            {backfillMessage && <AdminNotice tone={/aplicat/.test(backfillMessage) ? "success" : "danger"} className="mt-3">{backfillMessage}</AdminNotice>}
          </AdminCard>
        </>
      )}
    </div>
  );
}
