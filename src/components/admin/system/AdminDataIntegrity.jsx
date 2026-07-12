import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const ACTIVE_SUBMISSION_STATUSES = new Set(["draft", "pending_review", "needs_more_info"]);
const VALID_ORGANIZATION_STATUSES = new Set(["activa", "inactiva"]);

function clean(value) {
  return String(value ?? "").trim();
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function organizationCompletion(organization) {
  const checks = [
    clean(organization.public_display_name),
    clean(organization.public_description),
    clean(organization.public_phone) || clean(organization.public_email),
    clean(organization.website_url) || clean(organization.facebook_url) || clean(organization.instagram_url) || clean(organization.linkedin_url),
    clean(organization.logo_url),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function locationCompletion(location) {
  const checks = [
    clean(location.public_display_name) || clean(location.name),
    clean(location.locality_name) || clean(location.city),
    clean(location.address),
    clean(location.public_phone) || clean(location.phone_public) || clean(location.public_email),
    clean(location.opening_hours_json) || clean(location.opening_hours),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function addIssue(target, issue) {
  target.push({ severity: "warning", category: "General", ...issue });
}

function inspectData({ organizations, locations, submissions, claims, services }) {
  const issues = [];
  const organizationMap = Object.fromEntries(organizations.map((item) => [item.id, item]));
  const locationMap = Object.fromEntries(locations.map((item) => [item.id, item]));
  const now = Date.now();

  for (const organization of organizations) {
    const name = organization.public_display_name || organization.name || "Organizatie fara nume";
    if (!VALID_ORGANIZATION_STATUSES.has(organization.status)) {
      addIssue(issues, {
        severity: "error",
        category: "Organizatii",
        title: `${name}: status organizational invalid`,
        detail: `Campul status are valoarea „${organization.status || "lipsa"}”. Valorile canonice sunt activa sau inactiva.`,
      });
    }

    const calculated = organizationCompletion(organization);
    const stored = Number(organization.profile_completeness || 0);
    if (Math.abs(calculated - stored) >= 20) {
      addIssue(issues, {
        category: "Completitudine",
        title: `${name}: completitudine nealiniata`,
        detail: `Valoare salvata ${stored}%, calcul curent ${calculated}%.`,
      });
    }

    const organizationLocations = locations.filter((location) => location.organization_id === organization.id);
    if (organizationLocations.length === 0) {
      addIssue(issues, {
        category: "Relatii",
        title: `${name}: organizatie fara locatie`,
        detail: "Organizatia nu are niciun punct de lucru asociat.",
      });
    }
  }

  for (const location of locations) {
    const name = location.public_display_name || location.name || "Locatie fara nume";
    if (!location.organization_id || !organizationMap[location.organization_id]) {
      addIssue(issues, {
        severity: "error",
        category: "Relatii",
        title: `${name}: organizatie lipsa`,
        detail: "Locatia nu este asociata unei organizatii existente.",
      });
    }

    if (location.status === "publicata" && location.profile_control_status !== "verified") {
      addIssue(issues, {
        severity: "error",
        category: "Statusuri",
        title: `${name}: publicata fara status verificat`,
        detail: `status = publicata, dar profile_control_status = ${location.profile_control_status || "lipsa"}.`,
      });
    }

    if (location.profile_control_status === "verified" && location.status !== "publicata") {
      addIssue(issues, {
        category: "Statusuri",
        title: `${name}: verificata, dar nepublicata`,
        detail: `profile_control_status = verified, dar status = ${location.status || "lipsa"}.`,
      });
    }

    if (location.status === "publicata" && location.public_visibility_status !== "approved") {
      addIssue(issues, {
        category: "Statusuri",
        title: `${name}: vizibilitate legacy nealiniata`,
        detail: `Locatia este publicata, dar public_visibility_status = ${location.public_visibility_status || "lipsa"}.`,
      });
    }

    if (location.claim_verification_status === "approved" && !["claimed", "verified"].includes(location.profile_control_status)) {
      addIssue(issues, {
        severity: "error",
        category: "Statusuri",
        title: `${name}: revendicare aprobata fara control asociat`,
        detail: `claim_verification_status = approved, dar profile_control_status = ${location.profile_control_status || "lipsa"}.`,
      });
    }

    if (clean(location.pending_changes)) {
      addIssue(issues, {
        category: "Legacy",
        title: `${name}: pending_changes legacy este inca populat`,
        detail: "Modificarile noi trebuie sa foloseasca ProviderWorkspaceSubmission.",
      });
    }

    const sourceCheckedAt = parseDate(location.source_checked_at);
    if (sourceCheckedAt && sourceCheckedAt.getTime() > now + 24 * 60 * 60 * 1000) {
      addIssue(issues, {
        severity: "error",
        category: "Provenienta",
        title: `${name}: data verificarii sursei este in viitor`,
        detail: sourceCheckedAt.toLocaleString("ro-RO"),
      });
    }

    const calculated = locationCompletion(location);
    const stored = Number(location.profile_completeness || 0);
    if (Math.abs(calculated - stored) >= 20) {
      addIssue(issues, {
        category: "Completitudine",
        title: `${name}: completitudine locatie nealiniata`,
        detail: `Valoare salvata ${stored}%, calcul curent ${calculated}%.`,
      });
    }
  }

  const signatureGroups = new Map();
  const activeGroups = new Map();
  for (const submission of submissions) {
    const signature = [
      submission.location_id || "",
      submission.organization_id || "",
      submission.section || "",
      submission.item_key || "",
      submission.payload_json || "",
      submission.status || "",
    ].join("::");
    if (!signatureGroups.has(signature)) signatureGroups.set(signature, []);
    signatureGroups.get(signature).push(submission);

    if (ACTIVE_SUBMISSION_STATUSES.has(submission.status)) {
      const activeKey = [submission.location_id || "", submission.organization_id || "", submission.section || "", submission.item_key || ""].join("::");
      if (!activeGroups.has(activeKey)) activeGroups.set(activeKey, []);
      activeGroups.get(activeKey).push(submission);
    }
  }

  for (const rows of signatureGroups.values()) {
    if (rows.length < 2) continue;
    const first = rows[0];
    const location = locationMap[first.location_id];
    addIssue(issues, {
      category: "Cereri",
      title: `${location?.public_display_name || location?.name || "Organizatie"}: cereri identice repetate`,
      detail: `${rows.length} cereri cu acelasi continut pentru sectiunea ${first.section || "necunoscuta"} si statusul ${first.status || "necunoscut"}.`,
    });
  }

  for (const rows of activeGroups.values()) {
    if (rows.length < 2) continue;
    const first = rows[0];
    const location = locationMap[first.location_id];
    addIssue(issues, {
      severity: "error",
      category: "Cereri",
      title: `${location?.public_display_name || location?.name || "Organizatie"}: mai multe cereri active pentru aceeasi sectiune`,
      detail: `${rows.length} cereri active pentru ${first.section || "sectiune necunoscuta"}.`,
    });
  }

  const activeClaimGroups = new Map();
  for (const claim of claims.filter((item) => ["in_asteptare", "needs_more_info"].includes(item.status))) {
    const key = [claim.location_id || "", claim.user_id || "", claim.mode || "claim"].join("::");
    if (!activeClaimGroups.has(key)) activeClaimGroups.set(key, []);
    activeClaimGroups.get(key).push(claim);
  }
  for (const rows of activeClaimGroups.values()) {
    if (rows.length < 2) continue;
    addIssue(issues, {
      severity: "error",
      category: "Revendicari",
      title: "Revendicari active duplicate",
      detail: `${rows.length} cereri active pentru aceeasi locatie si acelasi utilizator.`,
    });
  }

  for (const service of services) {
    const location = locationMap[service.location_id];
    if (!location) {
      addIssue(issues, {
        severity: "error",
        category: "Relatii",
        title: `${service.service_key || "Serviciu"}: locatie inexistenta`,
        detail: "Serviciul este orfan si nu poate participa corect la publicare sau matching.",
      });
    }
    if (service.migration_review_required) {
      addIssue(issues, {
        category: "Migrare",
        title: `${service.service_key || "Serviciu"}: review de migrare necesar`,
        detail: location ? `Locatie: ${location.public_display_name || location.name}` : "Locatie necunoscuta",
      });
    }
  }

  return issues.sort((left, right) => {
    const weight = { error: 0, warning: 1, info: 2 };
    return (weight[left.severity] ?? 9) - (weight[right.severity] ?? 9) || left.category.localeCompare(right.category);
  });
}

function IssueRow({ issue }) {
  const critical = issue.severity === "error";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${critical ? "border-red-200 bg-red-50/70" : "border-amber-200 bg-amber-50/60"}`}>
      <div className="flex items-start gap-3">
        {critical ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold">{issue.title}</div>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{issue.category}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{issue.detail}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDataIntegrity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [organizations, locations, submissions, claims, services] = await Promise.all([
        base44.entities.ProviderOrganization.list("name", 500),
        base44.entities.ProviderLocation.list("name", 500),
        base44.entities.ProviderWorkspaceSubmission.list("-created_date", 500),
        base44.entities.ProviderClaimRequest.list("-created_date", 500),
        base44.entities.LocationService.list(null, 500),
      ]);
      setData({ organizations, locations, submissions, claims, services });
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut verifica integritatea datelor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const issues = useMemo(() => data ? inspectData(data) : [], [data]);
  const criticalCount = issues.filter((item) => item.severity === "error").length;
  const warningCount = issues.filter((item) => item.severity !== "error").length;
  const groups = useMemo(() => {
    const output = new Map();
    for (const issue of issues) {
      if (!output.has(issue.category)) output.set(issue.category, []);
      output.get(issue.category).push(issue);
    }
    return [...output.entries()];
  }, [issues]);

  return (
    <div className="space-y-5">
      <AdminCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><DatabaseZap className="h-5 w-5 text-muted-foreground" /><h2 className="font-heading text-base font-bold">Verificare read-only</h2></div>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Analizeaza relatiile, statusurile, completitudinea, cererile duplicate si datele legacy. Aceasta pagina nu modifica si nu sterge nimic.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Reincarca
          </button>
        </div>
        {data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3"><div className="text-[11px] font-semibold text-red-700">CRITICE</div><div className="mt-1 text-2xl font-bold text-red-900">{criticalCount}</div></div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"><div className="text-[11px] font-semibold text-amber-700">AVERTISMENTE</div><div className="mt-1 text-2xl font-bold text-amber-900">{warningCount}</div></div>
            <div className="rounded-2xl border border-border bg-secondary/35 px-4 py-3"><div className="text-[11px] font-semibold text-muted-foreground">INREGISTRARI ANALIZATE</div><div className="mt-1 text-2xl font-bold">{Object.values(data).reduce((sum, rows) => sum + rows.length, 0)}</div></div>
          </div>
        )}
      </AdminCard>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!data && !error && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se verifica datele...</div>}

      {data && issues.length === 0 && (
        <AdminCard className="p-5"><EmptyState icon={CheckCircle2} title="Nu au fost detectate neconcordante." subtitle="Verificarea este read-only si reflecta regulile curente ale aplicatiei." /></AdminCard>
      )}

      {data && groups.map(([category, categoryIssues]) => (
        <AdminCard key={category} className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-sm font-bold">{category}</h3>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">{categoryIssues.length}</span>
          </div>
          <div className="mt-3 space-y-2">{categoryIssues.map((issue, index) => <IssueRow key={`${issue.title}-${index}`} issue={issue} />)}</div>
        </AdminCard>
      ))}
    </div>
  );
}
