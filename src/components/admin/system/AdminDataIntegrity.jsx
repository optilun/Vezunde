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
import { locationStatusIssues } from "@/lib/adminLocationStatusRules";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminHint from "@/components/admin/ui/AdminHint";
import { useAdminConfirm } from "@/components/admin/ui/AdminConfirm";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";

const ACTIVE_SUBMISSION_STATUSES = new Set(["draft", "pending_review", "needs_more_info"]);
const VALID_ORGANIZATION_STATUSES = new Set(["activa", "inactiva"]);
const REPAIR_TYPES_BY_CATEGORY = {
  Completitudine: new Set(["organization_completeness", "location_completeness"]),
  Organizatii: new Set(["organization_status"]),
  Statusuri: new Set(["location_publication_alignment"]),
  Cereri: new Set(["identical_active_submissions"]),
};
const INTEGRITY_BATCH_OPTIONS = [25, 50, 100, 250];
// Cheile de mai sus (Organizatii, Statusuri…) selectează reparațiile și nu se schimbă; textul afișat vine de aici.
const CATEGORY_LABELS = {
  Completitudine: "Completitudine",
  Organizatii: "Organizații",
  Relatii: "Relații",
  Statusuri: "Stări",
  Provenienta: "Proveniență",
  Cereri: "Cereri",
  Revendicari: "Revendicări",
  Migrare: "Migrare",
  Legacy: "Date vechi",
  General: "General",
};
const categoryLabel = (category) => CATEGORY_LABELS[category] || category;

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
    const name = organization.public_display_name || organization.name || "Organizație fără nume";
    if (!VALID_ORGANIZATION_STATUSES.has(organization.status)) {
      addIssue(issues, {
        severity: "error",
        category: "Organizatii",
        title: `${name}: status organizațional invalid`,
        detail: `Câmpul status are valoarea „${organization.status || "lipsă"}”. Valorile corecte sunt „activa” sau „inactiva”.`,
      });
    }

    const calculated = organizationCompletion(organization);
    const stored = Number(organization.profile_completeness || 0);
    if (Math.abs(calculated - stored) >= 20) {
      addIssue(issues, {
        category: "Completitudine",
        title: `${name}: completitudine nealiniată`,
        detail: `Valoare salvată ${stored}%, calcul curent ${calculated}%.`,
      });
    }

    const organizationLocations = locations.filter((location) => location.organization_id === organization.id);
    if (organizationLocations.length === 0) {
      addIssue(issues, {
        category: "Relatii",
        title: `${name}: organizație fără locație`,
        detail: "Organizația nu are niciun punct de lucru asociat.",
      });
    }
  }

  for (const location of locations) {
    const name = location.public_display_name || location.name || "Locație fără nume";
    if (!location.organization_id || !organizationMap[location.organization_id]) {
      addIssue(issues, {
        severity: "error",
        category: "Relatii",
        title: `${name}: organizație lipsă`,
        detail: "Locația nu este asociată unei organizații existente.",
      });
    }

    // 2026-10-07: regulile de stare sunt cele comune cu ecranul Profiluri (src/lib/adminLocationStatusRules.js).
    // „Publicata fara status verificat” a fost scoasa: un profil din director, publicat si
    // nerevendicat este starea normala dupa import, nu o eroare (~1.200-1.500 de alarme false).
    for (const issue of locationStatusIssues(location)) {
      addIssue(issues, {
        severity: issue.severity,
        category: issue.category,
        title: `${name}: ${issue.text}`,
        detail: issue.detail,
      });
    }

    const sourceCheckedAt = parseDate(location.source_checked_at);
    if (sourceCheckedAt && sourceCheckedAt.getTime() > now + 24 * 60 * 60 * 1000) {
      addIssue(issues, {
        severity: "error",
        category: "Provenienta",
        title: `${name}: data verificării sursei este în viitor`,
        detail: sourceCheckedAt.toLocaleString("ro-RO"),
      });
    }

    const calculated = locationCompletion(location);
    const stored = Number(location.profile_completeness || 0);
    if (Math.abs(calculated - stored) >= 20) {
      addIssue(issues, {
        category: "Completitudine",
        title: `${name}: completitudine locație nealiniată`,
        detail: `Valoare salvată ${stored}%, calcul curent ${calculated}%.`,
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
      title: `${location?.public_display_name || location?.name || "Organizație"}: cereri identice repetate`,
      detail: `${rows.length} cereri cu același conținut pentru secțiunea ${first.section || "necunoscută"} și statusul ${first.status || "necunoscut"}.`,
    });
  }

  for (const rows of activeGroups.values()) {
    if (rows.length < 2) continue;
    const first = rows[0];
    const location = locationMap[first.location_id];
    addIssue(issues, {
      severity: "error",
      category: "Cereri",
      title: `${location?.public_display_name || location?.name || "Organizație"}: mai multe cereri active pentru aceeași secțiune`,
      detail: `${rows.length} cereri active pentru ${first.section || "secțiune necunoscută"}.`,
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
      title: "Revendicări active duplicate",
      detail: `${rows.length} cereri active pentru aceeași locație și același utilizator.`,
    });
  }

  for (const service of services) {
    const location = locationMap[service.location_id];
    if (!location) {
      addIssue(issues, {
        severity: "error",
        category: "Relatii",
        title: `${service.service_key || "Serviciu"}: locație inexistentă`,
        detail: "Serviciul este orfan și nu poate participa corect la publicare sau matching.",
      });
    }
    if (service.migration_review_required) {
      addIssue(issues, {
        category: "Migrare",
        title: `${service.service_key || "Serviciu"}: verificare de migrare necesară`,
        detail: location ? `Locație: ${location.public_display_name || location.name}` : "Locație necunoscută",
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
    <div className={`rounded-2xl border px-4 py-3 ${critical ? "border-danger-border bg-danger-soft" : "border-warning-border bg-warning-soft"}`}>
      <div className="flex items-start gap-3">
        {critical ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold">{issue.title}</div>
            <span className="rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{categoryLabel(issue.category)}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{issue.detail}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminDataIntegrity() {
  const confirm = useAdminConfirm();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkScope, setBulkScope] = useState("current");
  const [batchSize, setBatchSize] = useState(100);
  const [bulkProgress, setBulkProgress] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [organizations, locations, submissions, claims, services] = await Promise.all([
        // Verificatorul de integritate trebuie sa vada TOATE inregistrarile, altfel poate
        // rata exact problemele pe care e menit sa le gaseasca. Limita de 500 trunchia
        // silentios analiza (descoperit 2026-08-06).
        base44.entities.ProviderOrganization.list("name", 5000),
        base44.entities.ProviderLocation.list("name", 5000),
        base44.entities.ProviderWorkspaceSubmission.list("-created_date", 5000),
        base44.entities.ProviderClaimRequest.list("-created_date", 5000),
        base44.entities.LocationService.list(null, 5000),
      ]);
      setData({ organizations, locations, submissions, claims, services });
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Nu am putut verifica integritatea datelor.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Verificarea citeste tot directorul, deci porneste doar la cerere, nu la deschiderea paginii.

  const issues = useMemo(() => data ? inspectData(data) : [], [data]);
  const criticalCount = issues.filter((item) => item.severity === "error").length;
  const warningCount = issues.filter((item) => item.severity !== "error").length;
  const groups = useMemo(() => {
    const output = new Map();
    for (const issue of issues) {
      if (!output.has(issue.category)) output.set(issue.category, []);
      output.get(issue.category).push(issue);
    }
    // Categoriile cu cele mai multe probleme critice apar primele - admin-ul vede
    // intai ce conteaza. Inainte, lista unica nepaginata devenea imposibil de
    // navigat cand o categorie avea 900+ randuri ("Statusuri", verificat 2026-08-22).
    return [...output.entries()].sort((left, right) => {
      const leftCritical = left[1].filter((item) => item.severity === "error").length;
      const rightCritical = right[1].filter((item) => item.severity === "error").length;
      return rightCritical - leftCritical || right[1].length - left[1].length;
    });
  }, [issues]);

  // Navigare pe categorii + paginare (2026-08-22): pagina randa altfel TOATE
  // categoriile si TOATE problemele deodata - cu 944 de intrari doar la
  // "Statusuri", devenea o lista interminabila si o pagina extrem de grea.
  const PAGE_SIZE = 40;
  const [activeCategory, setActiveCategory] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!groups.length) { setActiveCategory(""); return; }
    if (!groups.some(([category]) => category === activeCategory)) {
      setActiveCategory(groups[0][0]);
      setPage(0);
    }
  }, [groups, activeCategory]);

  const activeIssues = useMemo(
    () => groups.find(([category]) => category === activeCategory)?.[1] || [],
    [groups, activeCategory],
  );
  const pageCount = Math.max(1, Math.ceil(activeIssues.length / PAGE_SIZE));
  const pagedIssues = activeIssues.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const runDeterministicRepairs = async () => {
    if (bulkRunning) return;
    setBulkRunning(true);
    setError("");
    setBulkMessage("");
    setBulkProgress(null);
    try {
      const scan = await base44.functions.invoke("adminDataIntegrityOps", { action: "scan" });
      if (scan.data?.error) throw new Error(scan.data.error);
      const allRepairs = scan.data?.repairs || [];
      const allowedTypes = bulkScope === "current" ? REPAIR_TYPES_BY_CATEGORY[activeCategory] : null;
      const selected = allowedTypes
        ? allRepairs.filter((repair) => allowedTypes.has(repair.repair_type))
        : allRepairs;

      if (selected.length === 0) {
        setBulkMessage(bulkScope === "current"
          ? "Categoria curentă nu are reparații deterministe disponibile. Problemele rămase necesită verificare umană."
          : "Nu există reparații deterministe disponibile acum.");
        return;
      }

      const confirmed = await confirm({
        title: `Aplici ${selected.length} reparații?`,
        description: bulkScope === "current"
          ? `Doar din categoria „${categoryLabel(activeCategory)}”. Fiecare reparație e reverificată de server înainte de aplicare și apare în Istoric audit.`
          : "Din toate categoriile. Fiecare reparație e reverificată de server înainte de aplicare și apare în Istoric audit.",
        confirmLabel: "Aplică reparațiile",
      });
      if (!confirmed) return;

      let applied = 0;
      let skipped = 0;
      let failed = 0;
      for (let offset = 0; offset < selected.length; offset += batchSize) {
        const chunk = selected.slice(offset, offset + batchSize);
        const response = await base44.functions.invoke("adminDataIntegrityOps", {
          action: "apply_batch",
          confirm: true,
          repairs: chunk.map((repair) => ({ id: repair.id, expected_signature: repair.expected_signature })),
        });
        if (response.data?.error) throw new Error(response.data.error);
        applied += response.data?.applied_count || 0;
        skipped += response.data?.skipped_count || 0;
        failed += response.data?.failed_count || 0;
        setBulkProgress({
          done: Math.min(selected.length, offset + chunk.length),
          total: selected.length,
          applied,
          skipped,
          failed,
        });
      }
      setBulkMessage(`Lot finalizat: ${applied} reparații aplicate, ${skipped} sărite, ${failed} eșuate.`);
      await load();
    } catch (reason) {
      setError(reason.response?.data?.error || reason.message || "Rularea în lot s-a oprit cu o eroare.");
    } finally {
      setBulkRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <AdminCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <DatabaseZap className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 className="font-heading text-base font-bold">Verificare date</h2>
              <AdminHint label="Ce verifică și ce modifică">
                Verificarea doar <strong>citește</strong>: relații, stări, completitudine, cereri duplicate și date vechi. Nu modifică nimic. Reparațiile de mai jos sunt acțiuni separate, cu confirmare.
              </AdminHint>
            </div>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {data ? "Reîncarcă" : "Pornește verificarea"}
          </button>
        </div>
        {data && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3"><div className="text-[11px] font-semibold text-danger">Critice</div><div className="mt-1 text-2xl font-bold tabular-nums text-danger">{criticalCount}</div></div>
            <div className="rounded-2xl border border-warning-border bg-warning-soft px-4 py-3"><div className="text-[11px] font-semibold text-warning">Avertismente</div><div className="mt-1 text-2xl font-bold tabular-nums text-warning">{warningCount}</div></div>
            <div className="rounded-2xl border border-border bg-secondary/35 px-4 py-3"><div className="text-[11px] font-semibold text-muted-foreground">Înregistrări analizate</div><div className="mt-1 text-2xl font-bold tabular-nums">{Object.values(data).reduce((sum, rows) => sum + rows.length, 0)}</div></div>
          </div>
        )}
      </AdminCard>

      {data && issues.length > 0 && (
        <AdminCard className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <div className="text-sm font-bold">Reparare în lot</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Aplică doar reparațiile deterministe, pe care serverul le poate recalcula și verifica. Relațiile orfane, conflictele de proveniență și migrările rămân pentru verificare manuală.
              </p>
            </div>
            <label className="w-[190px] text-[11px] font-semibold text-muted-foreground">
              Domeniu
              <select value={bulkScope} onChange={(event) => setBulkScope(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground">
                <option value="current">Categoria curentă: {activeCategory ? categoryLabel(activeCategory) : "—"}</option>
                <option value="all">Toate reparațiile sigure</option>
              </select>
            </label>
            <label className="w-[145px] text-[11px] font-semibold text-muted-foreground">
              Mărime lot
              <select value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground">
                {INTEGRITY_BATCH_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button type="button" onClick={runDeterministicRepairs} disabled={bulkRunning || loading} className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50">
              {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />}
              {bulkRunning ? "Se repară loturile..." : "Repară în lot"}
            </button>
          </div>
          {bulkProgress && <div className="mt-3 text-xs text-muted-foreground">Procesate {bulkProgress.done}/{bulkProgress.total} · aplicate {bulkProgress.applied} · sărite {bulkProgress.skipped} · eșuate {bulkProgress.failed}</div>}
          {bulkMessage && <div className="mt-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 text-xs">{bulkMessage}</div>}
        </AdminCard>
      )}

      {error && <AdminNotice tone="danger">{error}</AdminNotice>}
      {!data && !error && loading && <AdminLoading label="Se verifică datele…" rows={3} />}
      {!data && !error && !loading && (
        <AdminCard className="p-5"><EmptyState icon={DatabaseZap} title="Verificarea pornește la cerere." subtitle="Apasă „Pornește verificarea” ca să analizezi datele." /></AdminCard>
      )}

      {data && issues.length === 0 && (
        <AdminCard className="p-5"><EmptyState icon={CheckCircle2} title="Nu am găsit neconcordanțe." /></AdminCard>
      )}

      {data && groups.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {groups.map(([category, categoryIssues]) => {
              const critical = categoryIssues.filter((item) => item.severity === "error").length;
              const active = category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => { setActiveCategory(category); setPage(0); }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"}`}
                >
                  {categoryLabel(category)}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-background/20" : "bg-secondary"}`}>
                    {critical > 0 ? `${critical} critice din ${categoryIssues.length}` : categoryIssues.length}
                  </span>
                </button>
              );
            })}
          </div>

          <AdminCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-heading text-sm font-bold">{categoryLabel(activeCategory)}</h3>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold">{activeIssues.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {pagedIssues.map((issue, index) => <IssueRow key={`${issue.title}-${page}-${index}`} issue={issue} />)}
            </div>
            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  className="rounded-full border border-border px-3 py-1.5 font-semibold hover:bg-secondary disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-muted-foreground">Pagina {page + 1} din {pageCount} · {activeIssues.length} probleme în această categorie</span>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  className="rounded-full border border-border px-3 py-1.5 font-semibold hover:bg-secondary disabled:opacity-40"
                >
                  Următor
                </button>
              </div>
            )}
          </AdminCard>
        </>
      )}
    </div>
  );
}