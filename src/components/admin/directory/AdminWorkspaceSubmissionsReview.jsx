import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Image as ImageIcon,
  Info,
  Link2,
  PackageOpen,
  XCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminDecisionBar from "@/components/admin/ui/AdminDecisionBar";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { mergeWorkspacePending } from "@/lib/adminCounts";
import { fetchByIds } from "@/lib/adminEntityBatch";
import { fullDateTime, oldestFirst, plural, waitingInfo } from "@/lib/adminFormat";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";
import {
  CARE_SETTINGS,
  getCapabilityDefinition,
  getFunctionalUnitDefinition,
} from "@/lib/providerLocationFunctionalUnits";

const SECTION_LABELS = {
  public_profile: "Profil public organizație",
  location_details: "Date locație",
  operating_hours: "Program",
  services: "Servicii și structură",
  team: "Specialiști",
  media: "Fotografie locație",
  article: "Articol",
};

const LOCATION_FIELDS = [
  ["public_display_name", "Nume public locație"],
  ["address", "Adresă"],
  ["city", "Localitate"],
  ["county", "Județ"],
  ["locality_siruta_code", "Codul localității"],
  ["public_phone", "Telefon public locație"],
  ["public_email", "Email public locație"],
  ["lat", "Latitudine"],
  ["lng", "Longitudine"],
  ["place_id", "Google Place ID"],
  ["map_precision", "Poziția pe hartă"],
];

const PUBLIC_PROFILE_FIELDS = [
  ["public_display_name", "Nume public organizație"],
  ["public_description", "Descriere"],
  ["public_phone", "Telefon general"],
  ["public_email", "Email general"],
  ["website_url", "Website"],
  ["facebook_url", "Facebook"],
  ["instagram_url", "Instagram"],
  ["linkedin_url", "LinkedIn"],
];

const OPERATING_HOURS_FIELDS = [
  ["opening_hours", "Program de lucru"],
  ["saturday_hours", "Program sâmbătă"],
  ["availability_status", "Disponibilitate"],
];

const SERVICE_LABELS = Object.values(SERVICE_GROUPS || {}).reduce(
  (accumulator, group) => ({ ...accumulator, ...(group.ids || {}) }),
  {},
);

const DECISION_FLASH = {
  approve: "Aprobat",
  request_more_info: "Cerere de informații trimisă",
  reject: "Respins",
};

function parsePayload(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function text(value) {
  if (value === "exact") return "Poziție confirmată";
  if (value === "approximate") return "Poziție de confirmat";
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return `${value.length} elemente`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function serviceLabel(id) {
  return SERVICE_LABELS[id] || id;
}

// 2026-09-03: cele trei profesii canonice vin din shared/professionalIdentity.js. Ultimele doua
// chei nu sunt profesii, ci roluri de echipa folosite doar in trimiterile din workspace-ul de
// furnizor; raman locale pentru ca nu au profil profesional propriu in VIASEE.
const EXTRA_TEAM_ROLE_LABELS = {
  contact_lens_specialist: "Specialist lentile de contact",
  optical_workshop_specialist: "Specialist atelier optic",
};

function roleLabel(role) {
  if (EXTRA_TEAM_ROLE_LABELS[role]) return EXTRA_TEAM_ROLE_LABELS[role];
  if (PROFESSIONAL_TYPE_LABELS[role]) return PROFESSIONAL_TYPE_LABELS[role];
  return role || "Specialist";
}

// 2026-10-07: se văd doar câmpurile care chiar se schimbă; restul stau în spatele unui comutator.
// Pe telefon, fiecare rând devine „Acum / Propus” pe două linii (nu trei coloane înghesuite).
function FieldComparison({ fields, payload, current }) {
  const [showAll, setShowAll] = useState(false);
  const rows = fields.map(([key, label]) => {
    const proposedGiven = Object.prototype.hasOwnProperty.call(payload, key);
    const before = text(current?.[key]);
    const after = proposedGiven ? text(payload[key]) : before;
    return { key, label, before, after, changed: proposedGiven && after !== before };
  });
  const changedRows = rows.filter((row) => row.changed);
  const unchangedCount = rows.length - changedRows.length;
  const visibleRows = showAll ? rows : changedRows;

  return (
    <div className="mt-3">
      {changedRows.length === 0 && (
        <AdminNotice tone="info">Nicio valoare nu diferă de ce e publicat acum.</AdminNotice>
      )}
      {visibleRows.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          <div className="hidden bg-secondary/60 px-3 py-2 text-xs font-semibold text-muted-foreground sm:grid sm:grid-cols-[11rem_1fr_1fr] sm:gap-3">
            <span>Câmp</span>
            <span>Publicat acum</span>
            <span>Propus</span>
          </div>
          <ul className="divide-y divide-border">
            {visibleRows.map((row) => (
              <li key={row.key} className="grid gap-0.5 px-3 py-2 text-xs sm:grid-cols-[11rem_1fr_1fr] sm:gap-3">
                <span className="font-semibold">{row.label}</span>
                <span className="break-words text-muted-foreground">
                  <span className="font-medium sm:hidden">Acum: </span>
                  {row.before}
                </span>
                <span className={row.changed ? "break-words font-semibold text-foreground" : "break-words text-muted-foreground"}>
                  <span className="font-medium text-muted-foreground sm:hidden">Propus: </span>
                  {row.changed ? row.after : "neschimbat"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {unchangedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
          className="mt-2 inline-flex min-h-9 items-center rounded-lg px-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {showAll ? "Ascunde câmpurile neschimbate" : `Arată și câmpurile neschimbate (${unchangedCount})`}
        </button>
      )}
    </div>
  );
}

function MediaImage({ url, label, emptyText, proposed = false }) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${proposed ? "border-info-border bg-info-soft/40" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-inherit px-3 py-2.5">
        <span className="text-xs font-bold">{label}</span>
        {proposed && <StatusBadge label="Propusă" tone="info" />}
      </div>
      <div className="aspect-[4/3] max-h-64 bg-secondary/30">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center text-muted-foreground">
            <ImageIcon className="h-7 w-7" aria-hidden="true" />
            <p className="mt-2 text-xs">{emptyText}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaPreview({ payload, current }) {
  const currentUrl = String(current?.photo_url || "").trim();
  const proposedUrl = String(payload.photo_url || payload.photo_data_url || "").trim();
  const removePhoto = payload.remove_photo === true;

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <MediaImage
        url={currentUrl}
        label="Fotografia publicată acum"
        emptyText="Locația nu are o fotografie publicată."
      />
      {removePhoto ? (
        <div className="flex aspect-[4/3] max-h-64 flex-col items-center justify-center rounded-2xl border border-danger-border bg-danger-soft px-6 text-center text-danger">
          <XCircle className="h-8 w-8" aria-hidden="true" />
          <div className="mt-3 text-sm font-bold">Eliminarea fotografiei</div>
          <p className="mt-1 text-xs leading-relaxed">Furnizorul cere eliminarea fotografiei publicate.</p>
        </div>
      ) : (
        <MediaImage
          url={proposedUrl}
          label="Fotografia trimisă spre aprobare"
          emptyText="Fotografia propusă nu poate fi încărcată."
          proposed
        />
      )}
    </div>
  );
}

// Casetele goale („Niciun spațiu declarat”) nu mai ocupă loc: se arată doar ce a declarat furnizorul.
function OperationalContext({ context }) {
  if (!context) return null;
  const units = context.functional_units || [];
  const capabilities = context.capabilities || [];
  const links = context.resource_links || {};
  const linkCounts = [
    ["Specialiști", links.professionals?.length || 0],
    ["Echipamente", links.equipment?.length || 0],
    ["Facilități", links.facilities?.length || 0],
  ];
  const hasLinks = linkCounts.some(([, count]) => count > 0);
  if (units.length === 0 && capabilities.length === 0 && !hasLinks) return null;
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-3">
      {units.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-bold"><Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Spații declarate</div>
          <div className="mt-2 space-y-1.5">
            {units.map((item) => (
              <div key={item.unit_key} className="rounded-lg bg-secondary/35 px-2.5 py-2 text-[11px]">
                <strong>{getFunctionalUnitDefinition(item.unit_key)?.title || item.unit_key}</strong>
                <div className="mt-0.5 text-muted-foreground">{CARE_SETTINGS[item.care_setting]?.label || item.care_setting}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {capabilities.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-bold"><PackageOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Capabilități</div>
          <div className="mt-2 space-y-1.5">
            {capabilities.map((item) => (
              <div key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-lg bg-secondary/35 px-2.5 py-2 text-[11px]">
                <strong>{getCapabilityDefinition(item.capability_key)?.title || item.capability_key}</strong>
                <div className="mt-0.5 text-muted-foreground">în {getFunctionalUnitDefinition(item.parent_unit_key)?.shortTitle || item.parent_unit_key}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasLinks && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 text-xs font-bold"><Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Resurse asociate</div>
          <div className="mt-2 space-y-1.5 text-[11px]">
            {linkCounts.map(([label, count]) => (
              <div key={label} className="flex justify-between rounded-lg bg-secondary/35 px-2.5 py-2"><span>{label}</span><strong>{count}</strong></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderDeclarationNotice({ review }) {
  const selectedCount = review?.summary?.selected_count || review?.services?.length || 0;
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-info-border bg-info-soft px-3 py-2 text-xs text-info">
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <strong>Servicii declarate de furnizor.</strong> Aprobarea verifică doar coerența.
        {selectedCount > 0 && <> {plural(selectedCount, "opțiune declarată", "opțiuni declarate")}.</>}
      </span>
      <AdminHint label="Ce verifică aprobarea serviciilor">
        Nu cerem acte, specialiști, echipamente sau alte dovezi pentru publicarea serviciilor în această etapă.
      </AdminHint>
    </div>
  );
}

function RemovalChips({ title, children }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] font-semibold text-warning">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function OperationalRemovalPreview({ payload }) {
  const units = payload.removal_unit_keys || [];
  const capabilities = payload.removal_capabilities || [];
  const resources = payload.resource_removals || {};
  const counts = [
    ["Specialiști", resources.professionals?.length || 0],
    ["Echipamente", resources.equipment?.length || 0],
    ["Facilități", resources.facilities?.length || 0],
  ];
  const total = units.length + capabilities.length + counts.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-warning-border bg-warning-soft p-3">
      <div className="text-xs font-bold text-warning">Eliminări solicitate</div>
      <p className="mt-1 text-[11px] leading-relaxed text-warning">Rămân în registrul aprobat până la decizie.</p>
      {units.length > 0 && (
        <RemovalChips title="Spații">
          {units.map((unitKey) => <span key={unitKey} className="rounded-full border border-warning-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">{getFunctionalUnitDefinition(unitKey)?.title || unitKey}</span>)}
        </RemovalChips>
      )}
      {capabilities.length > 0 && (
        <RemovalChips title="Activități speciale">
          {capabilities.map((item) => <span key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-full border border-warning-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">{getCapabilityDefinition(item.capability_key)?.title || item.capability_key}</span>)}
        </RemovalChips>
      )}
      {counts.some(([, count]) => count > 0) && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {counts.filter(([, count]) => count > 0).map(([label, count]) => (
            <div key={label} className="rounded-lg bg-card px-2.5 py-2 text-[11px]">{label} <strong className="float-right">{count}</strong></div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServicesPreview({ payload, review }) {
  const selected = payload.selected_ids || {};
  const removals = payload.removal_ids || {};
  const suggestions = payload.suggestions || payload.custom_requests || [];
  const groups = [...new Set([...Object.keys(selected), ...Object.keys(removals)])];
  const hasGroups = groups.some((group) => (selected[group] || []).length || (removals[group] || []).length);
  return (
    <>
      <OperationalContext context={review?.operational_context || {
        functional_units: payload.functional_units,
        capabilities: payload.capabilities,
        care_setting: payload.care_setting,
        service_unit_map: payload.service_unit_map,
        resource_links: payload.resource_links,
      }} />
      <OperationalRemovalPreview payload={payload} />
      {(hasGroups || suggestions.length > 0) && (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-secondary/20 p-3">
          {groups.map((group) => {
            const add = selected[group] || [];
            const remove = removals[group] || [];
            if (!add.length && !remove.length) return null;
            return (
              <div key={group} className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs font-bold">{SERVICE_GROUPS[group]?.label || group}</div>
                {add.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] font-semibold text-info">De aprobat și adăugat</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{add.map((id) => <span key={id} className="rounded-full border border-info-border bg-info-soft px-2.5 py-1 text-[11px] font-semibold text-info">{serviceLabel(id)}</span>)}</div>
                  </div>
                )}
                {remove.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] font-semibold text-danger">De eliminat</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">{remove.map((id) => <span key={id} className="rounded-full border border-danger-border bg-danger-soft px-2.5 py-1 text-[11px] font-semibold text-danger">{serviceLabel(id)}</span>)}</div>
                  </div>
                )}
              </div>
            );
          })}
          {suggestions.length > 0 && (
            <div className="rounded-xl border border-warning-border bg-warning-soft p-3">
              <div className="text-xs font-bold text-warning">Propuneri pentru catalog</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{suggestions.map((item, index) => <span key={`${item.label}-${index}`} className="rounded-full border border-warning-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">{item.label}</span>)}</div>
            </div>
          )}
        </div>
      )}
      <ProviderDeclarationNotice review={review} />
    </>
  );
}

function TeamPreview({ payload }) {
  const invitations = payload.invitations || [];
  const members = payload.members || [];
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/20 p-3">
      {[...invitations, ...members].length > 0 ? (
        <>
          {invitations.map((item, index) => <div key={`${item.email}-${index}`} className="text-xs"><strong>{roleLabel(item.professional_role)}</strong> · invitat: {item.email}</div>)}
          {members.map((item, index) => <div key={`${item.full_name}-${index}`} className="text-xs"><strong>{item.full_name}</strong> · {roleLabel(item.professional_type)}</div>)}
        </>
      ) : <p className="text-xs text-muted-foreground">Cererea nu conține specialiști.</p>}
    </div>
  );
}

function Comparison({ submission, location, organization }) {
  const payload = parsePayload(submission.payload_json);
  if (submission.section === "location_details") return <FieldComparison fields={LOCATION_FIELDS} payload={payload} current={location} />;
  if (submission.section === "public_profile") return <FieldComparison fields={PUBLIC_PROFILE_FIELDS} payload={payload} current={organization} />;
  if (submission.section === "operating_hours") return <FieldComparison fields={OPERATING_HOURS_FIELDS} payload={payload} current={location} />;
  if (submission.section === "services") return <ServicesPreview payload={payload} review={submission.prerequisite_review} />;
  if (submission.section === "team") return <TeamPreview payload={payload} />;
  if (submission.section === "media" && payload.kind === "location_photo") return <MediaPreview payload={payload} current={location} />;
  return (
    <details className="mt-3 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-semibold">Datele trimise (format tehnic)</summary>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>
    </details>
  );
}

function SubmissionCard({ submission, location, organization, busy, onDecision }) {
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const locationName = location?.public_display_name || location?.name || "Locație necunoscută";
  const organizationName = organization?.public_display_name || organization?.name || "Organizație necunoscută";
  const subjectName = submission.section === "public_profile" ? organizationName : locationName;
  const title = submission.section === "article" ? payload.title || subjectName : subjectName;
  const waiting = waitingInfo(submission.submitted_at);
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{title}</h3>
            <StatusBadge label={SECTION_LABELS[submission.section] || submission.section} />
          </div>
          {submission.section !== "public_profile" && organization && (
            <p className="mt-1 text-xs text-muted-foreground">{organizationName}</p>
          )}
        </div>
        {waiting ? (
          <StatusBadge
            label={`Trimisă ${waiting.label}`}
            tone={waiting.tone}
            className="self-start"
          />
        ) : (
          <StatusBadge label="Dată necunoscută" />
        )}
      </div>
      {submission.submitted_at && (
        <p className="sr-only">Trimisă la {fullDateTime(submission.submitted_at)}</p>
      )}
      <Comparison submission={submission} location={location} organization={organization} />
      <AdminDecisionBar
        className="mt-4"
        busy={busy}
        onDecide={(action, note) => onDecision(submission, action, note)}
        actions={[
          { key: "approve", label: "Aprobă", icon: CheckCircle2, tone: "primary", note: "optional" },
          { key: "request_more_info", label: "Cere informații", icon: Info, note: "required", noteLabel: "Ce informații lipsesc?", notePlaceholder: "Furnizorul vede acest mesaj.", noteRequiredMessage: "Scrie ce informații trebuie completate.", confirmLabel: "Trimite cererea" },
          { key: "reject", label: "Respinge", icon: XCircle, tone: "danger", note: "required", noteLabel: "Motivul respingerii", notePlaceholder: "Furnizorul vede acest motiv.", noteRequiredMessage: "Scrie motivul respingerii.", confirmLabel: "Respinge modificarea" },
        ]}
      />
    </article>
  );
}

export default function AdminWorkspaceSubmissionsReview() {
  const { refresh: refreshCounts } = useAdminCounts();
  const [submissions, setSubmissions] = useState(null);
  const [locations, setLocations] = useState({});
  const [organizations, setOrganizations] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  // 2026-10-07 (audit admin): nu mai citeste tot directorul (2 x 5.000 de randuri, la fiecare
  // deschidere si dupa fiecare decizie) doar pentru cateva nume; se citesc numai locatiile si
  // organizatiile cererilor in asteptare.
  const load = async () => {
    setError("");
    const [pendingResponse, organizationResponse] = await Promise.all([
      base44.functions.invoke("adminServiceConfigurationReview", { action: "list", status: "pending_review" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
      base44.functions.invoke("adminOrganizationProfileReview", { action: "list", status: "pending_review" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
    ]);
    const errors = [pendingResponse.data?.error, organizationResponse.data?.error].filter(Boolean);
    if (errors.length > 0) setError(errors.join(" "));
    const merged = oldestFirst(
      mergeWorkspacePending(pendingResponse.data?.submissions, organizationResponse.data?.submissions),
      (submission) => submission.submitted_at || submission.created_date,
    );
    const enriched = await Promise.all(merged.map(async (submission) => {
      if (submission.section !== "services") return submission;
      const detail = await base44.functions.invoke("adminServiceConfigurationReview", { action: "get", submission_id: submission.id }).catch(() => ({ data: {} }));
      return { ...submission, prerequisite_review: detail.data?.prerequisite_review || null };
    }));
    const [locationResult, organizationResult] = await Promise.all([
      fetchByIds(base44.entities.ProviderLocation, merged.map((submission) => submission.location_id)),
      fetchByIds(base44.entities.ProviderOrganization, merged.map((submission) => submission.organization_id)),
    ]);
    setSubmissions(enriched);
    setLocations(locationResult.byId);
    setOrganizations(organizationResult.byId);
    if (locationResult.failed || organizationResult.failed) {
      setError((current) => [current, "Unele nume de locații sau organizații nu s-au putut încărca."].filter(Boolean).join(" "));
    }
  };

  useEffect(() => { load(); }, []);

  // Aruncă la eroare: bara de decizie arată mesajul chiar sub butoanele apăsate. După reușită,
  // elementul dispare imediat din listă (fără să aștepte reîncărcarea) și lista se reîmprospătează în fundal.
  const decide = async (submission, action, note) => {
    setBusy(true);
    try {
      const payload = parsePayload(submission.payload_json);
      const functionName = submission.section === "public_profile" && submission.organization_id
        ? "adminOrganizationProfileReview"
        : submission.section === "media" && payload.kind === "location_photo"
          ? "locationPhotoOps"
          : "adminServiceConfigurationReview";
      const response = await base44.functions.invoke(functionName, { action, submission_id: submission.id, note: note || "" });
      if (response.data?.error) throw new Error(response.data.error);
    } finally {
      setBusy(false);
    }
    const remaining = Math.max(0, (submissions?.length || 1) - 1);
    setSubmissions((current) => (current || []).filter((item) => item.id !== submission.id));
    setFlash(`${DECISION_FLASH[action] || "Decizie aplicată"}. ${remaining === 0 ? "Coada e goală." : `Mai ${remaining === 1 ? "e 1" : `sunt ${remaining}`} în coadă.`}`);
    refreshCounts();
    load().catch(() => {});
  };

  if (!submissions) return <AdminLoading label="Se încarcă modificările…" />;
  return (
    <AdminCard className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-bold">Modificări în verificare</h2>
          <AdminHint label="Cum se compară modificările">
            Se văd doar câmpurile care se schimbă față de ce e publicat acum. Fotografiile se văd direct, iar serviciile sunt informații declarate de furnizor.
          </AdminHint>
        </div>
        <StatusBadge label={`${submissions.length} în așteptare`} />
      </div>
      {error && <AdminNotice tone="danger" className="mt-3">{error}</AdminNotice>}
      {flash && <AdminNotice tone="success" className="mt-3" onDismiss={() => setFlash("")}>{flash}</AdminNotice>}
      <div className="mt-4 space-y-3">
        {submissions.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nu există modificări în verificare." subtitle="Cererile trimise de furnizori vor apărea aici." />
        ) : submissions.map((submission) => (
          <SubmissionCard
            key={submission.id}
            submission={submission}
            location={locations[submission.location_id]}
            organization={organizations[submission.organization_id]}
            busy={busy}
            onDecision={decide}
          />
        ))}
      </div>
    </AdminCard>
  );
}
