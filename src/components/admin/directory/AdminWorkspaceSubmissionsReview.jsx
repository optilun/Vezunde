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
import EmptyState from "@/components/admin/ui/EmptyState";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import { PROFESSIONAL_TYPE_LABELS } from "@/lib/professionalProfileCatalog";
import {
  CARE_SETTINGS,
  getCapabilityDefinition,
  getFunctionalUnitDefinition,
} from "@/lib/providerLocationFunctionalUnits";

const SECTION_LABELS = {
  public_profile: "Profil public organizatie",
  location_details: "Date locatie",
  operating_hours: "Program",
  services: "Servicii si structura",
  team: "Specialisti",
  media: "Fotografie locatie",
  article: "Articol",
};

const LOCATION_FIELDS = [
  ["public_display_name", "Nume public locatie"],
  ["address", "Adresa"],
  ["public_phone", "Telefon public locatie"],
  ["public_email", "Email public locatie"],
  ["lat", "Latitudine"],
  ["lng", "Longitudine"],
  ["place_id", "Google Place ID"],
];

const PUBLIC_PROFILE_FIELDS = [
  ["public_display_name", "Nume public organizatie"],
  ["public_description", "Descriere"],
  ["public_phone", "Telefon general"],
  ["public_email", "Email general"],
  ["website_url", "Website"],
  ["facebook_url", "Facebook"],
  ["instagram_url", "Instagram"],
  ["linkedin_url", "LinkedIn"],
];

const SERVICE_LABELS = Object.values(SERVICE_GROUPS || {}).reduce(
  (accumulator, group) => ({ ...accumulator, ...(group.ids || {}) }),
  {},
);

function parsePayload(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function text(value) {
  if (value === null || value === undefined || value === "") return "-";
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

function FieldComparison({ fields, payload, current }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/60 text-muted-foreground">
          <tr><th className="px-3 py-2">Camp</th><th className="px-3 py-2">Publicat acum</th><th className="px-3 py-2">Propus</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {fields.map(([key, label]) => (
            <tr key={key}>
              <td className="px-3 py-2 font-semibold">{label}</td>
              <td className="px-3 py-2 text-muted-foreground">{text(current?.[key])}</td>
              <td className="px-3 py-2 font-medium">{Object.prototype.hasOwnProperty.call(payload, key) ? text(payload[key]) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MediaImage({ url, label, emptyText, proposed = false }) {
  return (
    <div className={`overflow-hidden rounded-2xl border ${proposed ? "border-blue-200 bg-blue-50/40" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between gap-3 border-b border-inherit px-3 py-2.5">
        <span className="text-xs font-bold">{label}</span>
        {proposed && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">Propusa</span>}
      </div>
      <div className="aspect-[4/3] bg-secondary/30">
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center text-muted-foreground">
            <ImageIcon className="h-7 w-7" />
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
    <div className="mt-3 rounded-2xl border border-border bg-secondary/20 p-3">
      <div className="mb-3">
        <div className="text-xs font-bold">Comparatie fotografie locatie</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Verifica fotografia publicata si fotografia trimisa de furnizor. Codul intern si URL-ul fisierului nu sunt afisate.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <MediaImage
          url={currentUrl}
          label="Fotografie publicata acum"
          emptyText="Locatia nu are o fotografie publicata."
        />
        {removePhoto ? (
          <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-6 text-center text-red-900">
            <XCircle className="h-8 w-8" />
            <div className="mt-3 text-sm font-bold">Eliminarea fotografiei</div>
            <p className="mt-1 text-xs leading-relaxed">Furnizorul solicita eliminarea fotografiei publicate.</p>
          </div>
        ) : (
          <MediaImage
            url={proposedUrl}
            label="Fotografie trimisa spre aprobare"
            emptyText="Fotografia propusa nu poate fi incarcata."
            proposed
          />
        )}
      </div>
    </div>
  );
}

function OperationalContext({ context }) {
  if (!context) return null;
  const units = context.functional_units || [];
  const capabilities = context.capabilities || [];
  const links = context.resource_links || {};
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-bold"><Building2 className="h-4 w-4 text-muted-foreground" /> Spatii declarate</div>
        <div className="mt-2 space-y-1.5">
          {units.length > 0 ? units.map((item) => (
            <div key={item.unit_key} className="rounded-lg bg-secondary/35 px-2.5 py-2 text-[11px]">
              <strong>{getFunctionalUnitDefinition(item.unit_key)?.title || item.unit_key}</strong>
              <div className="mt-0.5 text-muted-foreground">{CARE_SETTINGS[item.care_setting]?.label || item.care_setting}</div>
            </div>
          )) : <p className="text-[11px] text-muted-foreground">Niciun spatiu declarat.</p>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-bold"><PackageOpen className="h-4 w-4 text-muted-foreground" /> Capabilitati</div>
        <div className="mt-2 space-y-1.5">
          {capabilities.length > 0 ? capabilities.map((item) => (
            <div key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-lg bg-secondary/35 px-2.5 py-2 text-[11px]">
              <strong>{getCapabilityDefinition(item.capability_key)?.title || item.capability_key}</strong>
              <div className="mt-0.5 text-muted-foreground">in {getFunctionalUnitDefinition(item.parent_unit_key)?.shortTitle || item.parent_unit_key}</div>
            </div>
          )) : <p className="text-[11px] text-muted-foreground">Nicio capabilitate declarata.</p>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-bold"><Link2 className="h-4 w-4 text-muted-foreground" /> Resurse asociate</div>
        <div className="mt-2 space-y-1.5 text-[11px]">
          <div className="flex justify-between rounded-lg bg-secondary/35 px-2.5 py-2"><span>Specialisti</span><strong>{links.professionals?.length || 0}</strong></div>
          <div className="flex justify-between rounded-lg bg-secondary/35 px-2.5 py-2"><span>Echipamente</span><strong>{links.equipment?.length || 0}</strong></div>
          <div className="flex justify-between rounded-lg bg-secondary/35 px-2.5 py-2"><span>Facilitati</span><strong>{links.facilities?.length || 0}</strong></div>
        </div>
      </div>
    </div>
  );
}

function ProviderDeclarationNotice({ review }) {
  const selectedCount = review?.summary?.selected_count || review?.services?.length || 0;
  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-blue-950">
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <div>
          <div className="text-xs font-bold">Servicii declarate de furnizor</div>
          <p className="mt-1 text-[11px] leading-relaxed">
            Aprobarea administrativă verifică doar coerența modificării. Nu cerem acte, specialiști, echipamente sau alte dovezi pentru publicarea serviciilor în această etapă.
          </p>
          {selectedCount > 0 && <p className="mt-1.5 text-[11px] font-semibold">{selectedCount} opțiuni declarate</p>}
        </div>
      </div>
    </div>
  );
}

function OperationalRemovalPreview({ payload }) {
  const units = payload.removal_unit_keys || [];
  const capabilities = payload.removal_capabilities || [];
  const resources = payload.resource_removals || {};
  const professionalCount = resources.professionals?.length || 0;
  const equipmentCount = resources.equipment?.length || 0;
  const facilityCount = resources.facilities?.length || 0;
  const total = units.length + capabilities.length + professionalCount + equipmentCount + facilityCount;
  if (total === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="text-xs font-bold text-amber-950">Eliminari operationale solicitate</div>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900">Elementele raman in registrul aprobat pana la decizie.</p>
      {units.length > 0 && <div className="mt-3"><div className="text-[11px] font-semibold text-amber-900">Spatii</div><div className="mt-1 flex flex-wrap gap-1.5">{units.map((unitKey) => <span key={unitKey} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">{getFunctionalUnitDefinition(unitKey)?.title || unitKey}</span>)}</div></div>}
      {capabilities.length > 0 && <div className="mt-3"><div className="text-[11px] font-semibold text-amber-900">Activitati speciale</div><div className="mt-1 flex flex-wrap gap-1.5">{capabilities.map((item) => <span key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">{getCapabilityDefinition(item.capability_key)?.title || item.capability_key}</span>)}</div></div>}
      {(professionalCount + equipmentCount + facilityCount) > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-amber-900">Specialisti <strong className="float-right">{professionalCount}</strong></div><div className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-amber-900">Echipamente <strong className="float-right">{equipmentCount}</strong></div><div className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-amber-900">Facilitati <strong className="float-right">{facilityCount}</strong></div></div>}
    </div>
  );
}

function ServicesPreview({ payload, review }) {
  const selected = payload.selected_ids || {};
  const removals = payload.removal_ids || {};
  const suggestions = payload.suggestions || payload.custom_requests || [];
  const groups = [...new Set([...Object.keys(selected), ...Object.keys(removals)])];
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
      <div className="mt-3 space-y-3 rounded-xl border border-border bg-secondary/20 p-3">
        {groups.map((group) => {
          const add = selected[group] || [];
          const remove = removals[group] || [];
          if (!add.length && !remove.length) return null;
          return (
            <div key={group} className="rounded-xl border border-border bg-card p-3">
              <div className="text-xs font-bold">{SERVICE_GROUPS[group]?.label || group}</div>
              {add.length > 0 && <div className="mt-2"><div className="text-[11px] font-semibold text-blue-700">De aprobat si adaugat</div><div className="mt-1 flex flex-wrap gap-1.5">{add.map((id) => <span key={id} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">{serviceLabel(id)}</span>)}</div></div>}
              {remove.length > 0 && <div className="mt-2"><div className="text-[11px] font-semibold text-red-700">De eliminat</div><div className="mt-1 flex flex-wrap gap-1.5">{remove.map((id) => <span key={id} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800">{serviceLabel(id)}</span>)}</div></div>}
            </div>
          );
        })}
        {suggestions.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="text-xs font-bold text-amber-900">Propuneri pentru catalog</div><div className="mt-2 flex flex-wrap gap-1.5">{suggestions.map((item, index) => <span key={`${item.label}-${index}`} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">{item.label}</span>)}</div></div>}
      </div>
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
          {invitations.map((item, index) => <div key={`${item.email}-${index}`} className="text-xs"><strong>{roleLabel(item.professional_role)}</strong> - {item.email}</div>)}
          {members.map((item, index) => <div key={`${item.full_name}-${index}`} className="text-xs"><strong>{item.full_name}</strong> - {roleLabel(item.professional_type)}</div>)}
        </>
      ) : <p className="text-xs text-muted-foreground">Nu exista specialisti in payload.</p>}
    </div>
  );
}

function Comparison({ submission, location, organization }) {
  const payload = parsePayload(submission.payload_json);
  if (submission.section === "location_details") return <FieldComparison fields={LOCATION_FIELDS} payload={payload} current={location} />;
  if (submission.section === "public_profile") return <FieldComparison fields={PUBLIC_PROFILE_FIELDS} payload={payload} current={organization} />;
  if (submission.section === "services") return <ServicesPreview payload={payload} review={submission.prerequisite_review} />;
  if (submission.section === "team") return <TeamPreview payload={payload} />;
  if (submission.section === "media" && payload.kind === "location_photo") return <MediaPreview payload={payload} current={location} />;
  return <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-secondary/40 p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>;
}

function SubmissionCard({ submission, location, organization, busy, onDecision }) {
  const [note, setNote] = useState("");
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const locationName = location?.public_display_name || location?.name || "Locatie necunoscuta";
  const organizationName = organization?.public_display_name || organization?.name || "Organizatie necunoscuta";
  const subjectName = submission.section === "public_profile" ? organizationName : locationName;
  const title = payload.public_display_name || payload.title || subjectName;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{title}</h3>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SECTION_LABELS[submission.section] || submission.section}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{subjectName} - trimisa {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("ro-RO") : "la o data necunoscuta"}</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">In verificare</span>
      </div>
      <Comparison submission={submission} location={location} organization={organization} />
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota admin. Obligatorie pentru respingere sau cerere de informatii." rows={2} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onDecision(submission, "approve", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" /> Aproba</button>
        <button disabled={busy} onClick={() => onDecision(submission, "request_more_info", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"><Info className="h-3.5 w-3.5" /> Cere informatii</button>
        <button disabled={busy} onClick={() => onDecision(submission, "reject", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Respinge</button>
      </div>
    </div>
  );
}

export default function AdminWorkspaceSubmissionsReview() {
  const [submissions, setSubmissions] = useState(null);
  const [locations, setLocations] = useState({});
  const [organizations, setOrganizations] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const [pendingResponse, organizationResponse, locationRows, organizationRows] = await Promise.all([
      base44.functions.invoke("adminServiceConfigurationReview", { action: "list", status: "pending_review" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
      base44.functions.invoke("adminOrganizationProfileReview", { action: "list", status: "pending_review" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
      base44.entities.ProviderLocation.list("name", 5000).catch(() => []),
      base44.entities.ProviderOrganization.list("name", 5000).catch(() => []),
    ]);
    const errors = [pendingResponse.data?.error, organizationResponse.data?.error].filter(Boolean);
    if (errors.length > 0) setError(errors.join(" "));
    const generalPending = (pendingResponse.data?.submissions || []).filter((submission) => !(submission.section === "public_profile" && submission.organization_id));
    const organizationPending = organizationResponse.data?.submissions || [];
    const merged = [...generalPending, ...organizationPending].filter((submission, index, rows) => rows.findIndex((item) => item.id === submission.id) === index);
    const enriched = await Promise.all(merged.map(async (submission) => {
      if (submission.section !== "services") return submission;
      const detail = await base44.functions.invoke("adminServiceConfigurationReview", { action: "get", submission_id: submission.id }).catch(() => ({ data: {} }));
      return { ...submission, prerequisite_review: detail.data?.prerequisite_review || null };
    }));
    setSubmissions(enriched);
    setLocations(Object.fromEntries(locationRows.map((location) => [location.id, location])));
    setOrganizations(Object.fromEntries(organizationRows.map((organization) => [organization.id, organization])));
  };

  useEffect(() => { load(); }, []);

  const decide = async (submission, action, note) => {
    setBusy(true);
    setError("");
    try {
      const payload = parsePayload(submission.payload_json);
      const functionName = submission.section === "public_profile" && submission.organization_id
        ? "adminOrganizationProfileReview"
        : submission.section === "media" && payload.kind === "location_photo"
          ? "locationPhotoOps"
          : "adminServiceConfigurationReview";
      const response = await base44.functions.invoke(functionName, { action, submission_id: submission.id, note: note || "" });
      if (response.data?.error) throw new Error(response.data.error);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "Nu am putut procesa decizia.");
    } finally {
      setBusy(false);
    }
  };

  if (!submissions) return <p className="text-sm text-muted-foreground">Se incarca modificarile workspace...</p>;
  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">Modificari workspace in verificare</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Profilurile organizationale sunt comparate cu ProviderOrganization. Fotografiile sunt afisate vizual, iar serviciile sunt tratate ca informatii declarate de furnizor.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{submissions.length} in asteptare</span>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="mt-4 space-y-3">
        {submissions.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nu exista modificari in verificare." subtitle="Cererile trimise de furnizori vor aparea aici." />
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
