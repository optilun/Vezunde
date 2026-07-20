import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronDown,
  Clock3,
  Image,
  Loader2,
  MapPin,
  Minus,
  Users,
  Wrench,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";

const MAX_LOCATIONS = 6;
const CONTROL_LABELS = {
  directory: "Nerevendicată",
  claimed: "Revendicată",
  verified: "Verificată",
  suspended: "Suspendată",
};
const SUBMISSION_LABELS = {
  draft: "Draft",
  pending_review: "În verificare",
  needs_more_info: "Necesită completări",
};

function locationName(location) {
  return location?.public_display_name || location?.name || "Locație";
}

function locationPlace(location) {
  return location?.locality_name || location?.city || location?.county_name || location?.county || "";
}

function initialSelection(locations, selectedLocationId) {
  const first = locations.find((location) => location.id === selectedLocationId)?.id || locations[0]?.id || "";
  const second = locations.find((location) => location.id !== first)?.id || "";
  return [first, second].filter(Boolean);
}

function Metric({ icon: Icon, label, value, helper = "", empty = false }) {
  const tone = empty
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : Number(value) > 0
      ? "border-green-200 bg-green-50 text-green-900"
      : "border-border bg-secondary/40 text-foreground";
  return (
    <div className={`rounded-2xl border p-3 ${tone}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold opacity-75"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="mt-1 text-lg font-extrabold">{value}</div>
      {helper && <div className="mt-0.5 text-[10px] leading-relaxed opacity-75">{helper}</div>}
    </div>
  );
}

function AvailabilityMark({ available }) {
  return available ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-800" aria-label="Disponibil"><Check className="h-3.5 w-3.5" /></span>
  ) : (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-muted-foreground" aria-label="Lipsește"><Minus className="h-3.5 w-3.5" /></span>
  );
}

export default function ProviderLocationComparisonPanel({ workspace, selectedLocationId }) {
  const locations = useMemo(() => {
    const all = Array.isArray(workspace?.locations) ? workspace.locations : [];
    const selected = all.find((location) => location.id === selectedLocationId) || all[0];
    if (!selected?.organization_id) return [];
    return all.filter((location) => location.organization_id === selected.organization_id);
  }, [workspace, selectedLocationId]);

  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => initialSelection(locations, selectedLocationId));
  const [comparison, setComparison] = useState(null);
  const [onlyDifferences, setOnlyDifferences] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const locationSignature = locations.map((location) => location.id).join(":");
  useEffect(() => {
    setSelectedIds((current) => {
      const valid = current.filter((id) => locations.some((location) => location.id === id));
      return valid.length >= 2 ? valid.slice(0, MAX_LOCATIONS) : initialSelection(locations, selectedLocationId);
    });
    setComparison(null);
    setError("");
  }, [locationSignature, selectedLocationId]);

  const workspaceLocationById = useMemo(
    () => Object.fromEntries(locations.map((location) => [location.id, location])),
    [locations],
  );
  const resultLocations = useMemo(() => {
    const byId = Object.fromEntries((comparison?.locations || []).map((location) => [location.id, location]));
    return selectedIds.map((id) => {
      const remote = byId[id];
      if (!remote) return null;
      const localCompleteness = Number(workspaceLocationById[id]?.profile_completeness);
      return {
        ...remote,
        profile_completeness: Number.isFinite(localCompleteness)
          ? localCompleteness
          : remote.comparison_coverage?.percentage || 0,
      };
    }).filter(Boolean);
  }, [comparison, selectedIds, workspaceLocationById]);

  const serviceRows = useMemo(() => {
    const services = new Map();
    resultLocations.forEach((location) => (location.service_entries || []).forEach((service) => services.set(service.key, service)));
    return [...services.values()].map((service) => {
      const availability = Object.fromEntries(resultLocations.map((location) => [
        location.id,
        (location.service_entries || []).some((entry) => entry.key === service.key),
      ]));
      const values = Object.values(availability);
      return { ...service, availability, differs: values.some(Boolean) && values.some((value) => !value) };
    }).filter((service) => !onlyDifferences || service.differs)
      .sort((a, b) => `${a.group}:${a.label}`.localeCompare(`${b.group}:${b.label}`, "ro"));
  }, [onlyDifferences, resultLocations]);

  if (locations.length < 2) return null;

  const resetResult = () => {
    setComparison(null);
    setError("");
  };

  const toggleLocation = (locationId) => {
    resetResult();
    setSelectedIds((current) => {
      if (current.includes(locationId)) return current.filter((id) => id !== locationId);
      return current.length >= MAX_LOCATIONS ? current : [...current, locationId];
    });
  };

  const loadComparison = async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    setError("");
    const response = await base44.functions.invoke("getProviderLocationComparison", {
      location_ids: selectedIds,
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setLoading(false);
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }
    setComparison(response.data);
  };

  return (
    <section className="rounded-[22px] border border-foreground/15 bg-card shadow-[0_14px_40px_rgba(23,23,23,0.035)]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left sm:px-5">
        <span className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary"><ArrowLeftRight className="h-4 w-4" /></span>
          <span className="min-w-0">
            <strong className="block text-sm">Compară locațiile</strong>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Vezi diferențele de program, servicii, specialiști, fotografii și configurare. Instrumentul nu modifică datele.</span>
          </span>
        </span>
        <ChevronDown className={`mt-2 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/70 px-4 py-5 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-bold">Alege între 2 și {MAX_LOCATIONS} locații</h3>
              <p className="mt-1 text-xs text-muted-foreground">Prima locație selectată este folosită ca reper vizual.</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">{selectedIds.length} selectate</span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {locations.map((location) => {
              const checked = selectedIds.includes(location.id);
              const index = selectedIds.indexOf(location.id);
              return (
                <label key={location.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition ${checked ? "border-foreground/35 bg-secondary/45" : "border-border bg-background hover:bg-secondary/20"}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleLocation(location.id)} className="mt-0.5 h-4 w-4" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <strong className="truncate text-sm">{locationName(location)}</strong>
                      {index === 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-[9px] font-bold text-background">Reper</span>}
                    </span>
                    <span className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /> {locationPlace(location) || "Localitate necompletată"}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {selectedIds.length < 2 && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Selectează cel puțin două locații pentru comparație.</div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={loadComparison} disabled={loading || selectedIds.length < 2} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40 sm:w-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />} Generează comparația
            </button>
            {comparison && <button type="button" onClick={resetResult} className="min-h-11 rounded-full border border-border px-5 text-sm font-semibold hover:bg-secondary">Modifică selecția</button>}
          </div>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          {comparison && resultLocations.length >= 2 && (
            <div className="mt-6 space-y-6">
              <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {resultLocations.map((location, index) => {
                  const missing = location.comparison_coverage?.checks?.filter((item) => !item.done) || [];
                  return (
                    <article key={location.id} className="min-w-0 rounded-[22px] border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-base font-extrabold">{location.name}</h4>{index === 0 && <span className="rounded-full bg-foreground px-2 py-0.5 text-[9px] font-bold text-background">Reper</span>}</div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{location.locality || "Localitate necompletată"}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{CONTROL_LABELS[location.profile_control_status] || location.profile_control_status}</span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Metric icon={Wrench} label="Servicii" value={location.service_entries.length} empty={location.service_entries.length === 0} />
                        <Metric icon={Users} label="Specialiști publici" value={location.public_team_count} helper={`${location.active_team_count} asocieri active`} empty={location.public_team_count === 0} />
                        <Metric icon={Image} label="Fotografii aprobate" value={location.approved_media_count + (location.has_primary_photo ? 1 : 0)} empty={!location.approved_media_count && !location.has_primary_photo} />
                        <Metric icon={Clock3} label="Modificări în lucru" value={location.pending_changes_count} helper={location.service_draft_status ? SUBMISSION_LABELS[location.service_draft_status] || location.service_draft_status : "Fără draft de servicii"} />
                      </div>

                      <div className="mt-4 rounded-2xl border border-border px-3 py-3">
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold"><span>Completitudine profil</span><span>{location.profile_completeness}%</span></div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-foreground" style={{ width: `${Math.max(0, Math.min(100, location.profile_completeness))}%` }} /></div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-border px-3 py-3">
                        <div className="flex items-center gap-2 text-xs font-bold"><Clock3 className="h-3.5 w-3.5" /> Program public</div>
                        <p className={`mt-2 text-xs leading-relaxed ${location.has_opening_hours ? "text-foreground" : "text-amber-800"}`}>{location.opening_hours || "Programul nu este configurat."}</p>
                      </div>

                      {missing.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Lipsește din acoperirea comparată</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">{missing.map((item) => <span key={item.key} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900">{item.label}</span>)}</div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <section className="rounded-[22px] border border-border bg-background">
                <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><h4 className="text-sm font-extrabold">Diferențe între servicii</h4><p className="mt-1 text-xs text-muted-foreground">{comparison.service_summary.differing_count} diferențe · {comparison.service_summary.common_count} servicii comune</p></div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={onlyDifferences} onChange={(event) => setOnlyDifferences(event.target.checked)} className="h-4 w-4" /> Doar diferențele</label>
                </div>

                {serviceRows.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">{onlyDifferences ? "Locațiile au aceleași servicii canonice active." : "Nu există servicii canonice active de comparat."}</p>
                ) : (
                  <>
                    <div className="divide-y divide-border md:hidden">
                      {serviceRows.map((service) => (
                        <div key={service.key} className="px-4 py-4">
                          <div className="text-sm font-bold">{service.label}</div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{SERVICE_GROUPS[service.group]?.label || service.group}</div>
                          <div className="mt-3 grid gap-2">{resultLocations.map((location) => <div key={location.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/35 px-3 py-2"><span className="min-w-0 truncate text-xs font-semibold">{location.name}</span><AvailabilityMark available={service.availability[location.id]} /></div>)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[760px] border-collapse text-left">
                        <thead><tr className="border-b border-border bg-secondary/25 text-[11px] text-muted-foreground"><th className="px-4 py-3 font-semibold">Serviciu</th>{resultLocations.map((location) => <th key={location.id} className="px-3 py-3 text-center font-semibold">{location.name}</th>)}</tr></thead>
                        <tbody className="divide-y divide-border">{serviceRows.map((service) => <tr key={service.key}><td className="px-4 py-3"><div className="text-sm font-semibold">{service.label}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{SERVICE_GROUPS[service.group]?.label || service.group}</div></td>{resultLocations.map((location) => <td key={location.id} className="px-3 py-3 text-center"><AvailabilityMark available={service.availability[location.id]} /></td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              <p className="text-xs leading-relaxed text-muted-foreground">Comparația este informativă și reflectă datele disponibile la momentul generării. Nu publică, nu copiază și nu modifică nicio locație.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
