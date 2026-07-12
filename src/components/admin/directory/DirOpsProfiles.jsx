import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PCS_LABELS } from "@/lib/directoryOpsCatalog";
import DirOpsActionNote from "@/components/admin/directory/DirOpsActionNote";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const FILTERS = [
  { key: "all", label: "Toate" },
  { key: "problems", label: "Status nealiniat" },
  { key: "directory", label: "Profiluri directory" },
  { key: "verified", label: "Verificate" },
  { key: "suspended", label: "Suspendate" },
];

function getStatusIssues(location) {
  const issues = [];
  if (location.status === "publicata" && location.profile_control_status !== "verified") {
    issues.push("Locatia este publicata, dar profilul nu este verificat.");
  }
  if (location.profile_control_status === "verified" && location.status !== "publicata") {
    issues.push("Profilul este verificat, dar locatia nu este publicata.");
  }
  if (location.status === "publicata" && location.public_visibility_status !== "approved") {
    issues.push(`Vizibilitatea legacy este ${location.public_visibility_status || "lipsa"}.`);
  }
  if (location.claim_verification_status === "approved" && !["claimed", "verified"].includes(location.profile_control_status)) {
    issues.push("Revendicarea este aprobata, dar controlul profilului nu reflecta aprobarea.");
  }
  if (location.pending_changes) issues.push("Campul legacy pending_changes este inca populat.");
  return issues;
}

function canonicalLabel(location) {
  if (location.profile_control_status === "suspended" || location.status === "suspendata") return "Suspendata";
  if (location.profile_control_status === "verified" && location.status === "publicata") return "Publicata si verificata";
  if (location.profile_control_status === "verified") return "Verificata, nepublicata";
  if (location.profile_control_status === "claimed") return "Revendicata";
  return "Profil directory";
}

function StatusBadge({ label, tone = "neutral" }) {
  const classes = {
    green: "border-green-200 bg-green-50 text-green-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    neutral: "border-border bg-background text-muted-foreground",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${classes[tone]}`}>{label}</span>;
}

export default function DirOpsProfiles() {
  const [locations, setLocations] = useState(null);
  const [organizations, setOrganizations] = useState({});
  const [action, setAction] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [locationRows, organizationRows] = await Promise.all([
        base44.entities.ProviderLocation.list("-updated_date", 500),
        base44.entities.ProviderOrganization.list("name", 500),
      ]);
      setLocations(locationRows);
      setOrganizations(Object.fromEntries(organizationRows.map((organization) => [organization.id, organization])));
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut incarca profilurile.");
      setLocations([]);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (note) => {
    setError("");
    try {
      await base44.functions.invoke("directoryOps", {
        action: action.type === "verify" ? "verify_profile" : "suspend_profile",
        location_id: action.locationId,
        note,
      });
      setAction(null);
      await load();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Actiunea nu a putut fi aplicata.");
    }
  };

  const visibleLocations = useMemo(() => {
    if (!locations) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return locations.filter((location) => {
      const issues = getStatusIssues(location);
      if (filter === "problems" && issues.length === 0) return false;
      if (filter === "directory" && (location.profile_control_status || "directory") !== "directory") return false;
      if (filter === "verified" && location.profile_control_status !== "verified") return false;
      if (filter === "suspended" && location.profile_control_status !== "suspended" && location.status !== "suspendata") return false;
      if (!normalizedQuery) return true;
      const organization = organizations[location.organization_id];
      return [location.name, location.public_display_name, location.city, location.county, organization?.name, organization?.public_display_name]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [filter, locations, organizations, query]);

  return (
    <div className="space-y-4">
      <AdminCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === item.key ? "bg-foreground text-background" : "border border-border bg-background hover:bg-secondary"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="flex min-w-64 items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta organizatie sau locatie" className="w-full bg-transparent text-xs outline-none" />
          </label>
        </div>
      </AdminCard>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!locations && <p className="text-sm text-muted-foreground">Se incarca...</p>}
      {locations && visibleLocations.length === 0 && (
        <AdminCard className="p-5"><EmptyState icon={Building2} title="Niciun profil pentru filtrul selectat." subtitle="Schimba filtrul sau termenul de cautare." /></AdminCard>
      )}

      {visibleLocations.map((location) => {
        const pcs = location.profile_control_status || "directory";
        const organization = organizations[location.organization_id];
        const issues = getStatusIssues(location);
        const canonical = canonicalLabel(location);
        const canonicalTone = canonical === "Publicata si verificata" ? "green" : canonical === "Suspendata" ? "red" : canonical === "Revendicata" ? "blue" : "neutral";
        return (
          <AdminCard key={location.id} className="p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[260px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-bold">{location.public_display_name || location.name}</div>
                  <StatusBadge label={canonical} tone={canonicalTone} />
                  {issues.length > 0 && <StatusBadge label={`${issues.length} neconcordante`} tone="amber" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {organization?.public_display_name || organization?.name || "Organizatie necunoscuta"} · {location.locality_name || location.city || "Localitate lipsa"}{location.county_name || location.county ? `, ${location.county_name || location.county}` : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <StatusBadge label={`Publicare: ${location.status || "lipsa"}`} tone={location.status === "publicata" ? "green" : location.status === "suspendata" ? "red" : "neutral"} />
                  <StatusBadge label={`Control: ${PCS_LABELS[pcs] || pcs}`} tone={pcs === "verified" ? "green" : pcs === "claimed" ? "blue" : pcs === "suspended" ? "red" : "neutral"} />
                  <StatusBadge label={`Revendicare: ${location.claim_verification_status || "none"}`} tone={location.claim_verification_status === "approved" ? "green" : location.claim_verification_status === "pending" ? "amber" : "neutral"} />
                  <StatusBadge label={`Activitate: ${location.active_status || "lipsa"}`} tone={location.active_status === "activa" ? "green" : "neutral"} />
                </div>
                {issues.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> Statusuri de verificat</div>
                    <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-amber-900">{issues.map((issue) => <li key={issue}>- {issue}</li>)}</ul>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">Sursa: {location.source_url ? <a href={location.source_url} target="_blank" rel="noreferrer" className="underline">{location.source_url}</a> : "lipsa"}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {pcs !== "verified" && (
                  <button onClick={() => setAction({ locationId: location.id, type: "verify" })} className="rounded-full border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">Verifica profil</button>
                )}
                {pcs !== "suspended" && (
                  <button onClick={() => setAction({ locationId: location.id, type: "suspend" })} className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-destructive hover:bg-secondary">Suspenda</button>
                )}
              </div>
            </div>
          </AdminCard>
        );
      })}

      {action && (
        <DirOpsActionNote
          title={action.type === "verify" ? "Verificare profil - nota obligatorie" : "Suspendare profil - nota obligatorie"}
          onConfirm={run}
          onCancel={() => setAction(null)}
        />
      )}
    </div>
  );
}
