import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Link2,
  PackageOpen,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";
import {
  CARE_SETTINGS,
  getCapabilityDefinition,
  getFunctionalUnitDefinition,
} from "@/lib/providerLocationFunctionalUnits";

const SECTION_LABELS = {
  public_profile: "Profil public",
  location_details: "Date locație",
  operating_hours: "Program",
  services: "Servicii și structură",
  team: "Specialiști",
  media: "Media",
  article: "Articol",
};

const LOCATION_FIELDS = [
  ["public_display_name", "Nume public locație"],
  ["address", "Adresă"],
  ["public_phone", "Telefon public locație"],
  ["public_email", "Email public locație"],
  ["lat", "Latitudine"],
  ["lng", "Longitudine"],
  ["place_id", "Google Place ID"],
];

const PUBLIC_PROFILE_FIELDS = [
  ["public_display_name", "Nume public"],
  ["public_description", "Descriere"],
  ["public_phone", "Telefon public"],
  ["public_email", "Email public"],
  ["website_url", "Website"],
  ["facebook_url", "Facebook"],
  ["instagram_url", "Instagram"],
  ["linkedin_url", "LinkedIn"],
];

const SERVICE_LABELS = Object.values(SERVICE_GROUPS || {}).reduce(
  (acc, group) => ({ ...acc, ...(group.ids || {}) }),
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

function roleLabel(role) {
  return {
    ophthalmologist: "Medic oftalmolog",
    optometrist: "Optometrist",
    optician: "Optician",
    contact_lens_specialist: "Specialist lentile de contact",
    optical_workshop_specialist: "Specialist atelier optic",
  }[role] || role || "Specialist";
}

function FieldComparison({ fields, payload, current }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/60 text-muted-foreground"><tr><th className="px-3 py-2">Câmp</th><th className="px-3 py-2">Publicat acum</th><th className="px-3 py-2">Propus</th></tr></thead>
        <tbody className="divide-y divide-border">
          {fields.map(([key, label]) => <tr key={key}><td className="px-3 py-2 font-semibold">{label}</td><td className="px-3 py-2 text-muted-foreground">{text(current?.[key])}</td><td className="px-3 py-2 font-medium">{Object.prototype.hasOwnProperty.call(payload, key) ? text(payload[key]) : "-"}</td></tr>)}
        </tbody>
      </table>
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
        <div className="flex items-center gap-2 text-xs font-bold"><Building2 className="h-4 w-4 text-muted-foreground" /> Spații declarate</div>
        <div className="mt-2 space-y-1.5">
          {units.length > 0 ? units.map((item) => <div key={item.unit_key} className="rounded-lg bg-secondary/35 px-2.5 py-2 text-[11px]"><strong>{getFunctionalUnitDefinition(item.unit_key)?.title || item.unit_key}</strong><div className="mt-0.5 text-muted-foreground">{CARE_SETTINGS[item.care_setting]?.label || item.care_setting}</div></div>) : <p className="text-[11px] text-muted-foreground">Niciun spațiu declarat.</p>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-bold"><PackageOpen className="h-4 w-4 text-muted-foreground" /> Capabilități</div>
        <div className="mt-2 space-y-1.5">
          {capabilities.length > 0 ? capabilities.map((item) => <div key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-lg bg-secondary/35 px-2.5 py-2 text-[11px]"><strong>{getCapabilityDefinition(item.capability_key)?.title || item.capability_key}</strong><div className="mt-0.5 text-muted-foreground">în {getFunctionalUnitDefinition(item.parent_unit_key)?.shortTitle || item.parent_unit_key}</div></div>) : <p className="text-[11px] text-muted-foreground">Nicio capabilitate declarată.</p>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-xs font-bold"><Link2 className="h-4 w-4 text-muted-foreground" /> Resurse asociate</div>
        <div className="mt-2 space-y-1.5 text-[11px]">
          <div className="flex justify-between rounded-lg bg-secondary/35 px-2.5 py-2"><span>Specialiști</span><strong>{links.professionals?.length || 0}</strong></div>
          <div className="flex justify-between rounded-lg bg-secondary/35 px-2.5 py-2"><span>Echipamente</span><strong>{links.equipment?.length || 0}</strong></div>
          <div className="flex justify-between rounded-lg bg-secondary/35 px-2.5 py-2"><span>Facilități</span><strong>{links.facilities?.length || 0}</strong></div>
        </div>
      </div>
    </div>
  );
}

function PrerequisiteChecklist({ review }) {
  if (!review) return null;
  const services = review.services || [];
  return (
    <div className={`mt-3 rounded-xl border p-3 ${review.approval_allowed ? "border-green-200 bg-green-50/70" : "border-amber-200 bg-amber-50/80"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">{review.approval_allowed ? <ShieldCheck className="h-4 w-4 text-green-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}<div className="text-xs font-bold">Verificarea cerințelor</div></div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold">{review.summary?.eligible_count || 0}/{review.summary?.selected_count || 0} eligibile</span>
      </div>
      <div className="mt-3 space-y-2">
        {services.map((service) => (
          <div key={service.service_key} className="rounded-lg border border-black/5 bg-white p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-xs font-semibold">{service.label || serviceLabel(service.service_key)}</span>{service.functional_unit_key && <div className="mt-0.5 text-[10px] text-muted-foreground">{getFunctionalUnitDefinition(service.functional_unit_key)?.shortTitle || service.functional_unit_key}</div>}</div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${service.eligible ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>{service.status_label || service.status}</span></div>
            {!service.eligible && <div className="mt-1.5 space-y-1">{(service.blockers || []).map((blocker, index) => <p key={`${blocker.code}-${index}`} className="text-[11px] leading-relaxed text-amber-900">• {blocker.message}</p>)}</div>}
          </div>
        ))}
      </div>
      {!review.approval_allowed && <p className="mt-2 text-[11px] font-semibold text-amber-900">Aprobarea este blocată până când toate cerințele sunt îndeplinite.</p>}
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
      <div className="text-xs font-bold text-amber-950">Eliminări operaționale solicitate</div>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-900">Aceste elemente rămân în registrul aprobat până la decizie. Serviciile publice afectate sunt suspendate pe durata verificării.</p>
      {units.length > 0 && <div className="mt-3"><div className="text-[11px] font-semibold text-amber-900">Spații</div><div className="mt-1 flex flex-wrap gap-1.5">{units.map((unitKey) => <span key={unitKey} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">{getFunctionalUnitDefinition(unitKey)?.title || unitKey}</span>)}</div></div>}
      {capabilities.length > 0 && <div className="mt-3"><div className="text-[11px] font-semibold text-amber-900">Activități speciale</div><div className="mt-1 flex flex-wrap gap-1.5">{capabilities.map((item) => <span key={`${item.capability_key}:${item.parent_unit_key}`} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">{getCapabilityDefinition(item.capability_key)?.title || item.capability_key}</span>)}</div></div>}
      {(professionalCount + equipmentCount + facilityCount) > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-amber-900">Specialiști <strong className="float-right">{professionalCount}</strong></div><div className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-amber-900">Echipamente <strong className="float-right">{equipmentCount}</strong></div><div className="rounded-lg bg-white px-2.5 py-2 text-[11px] text-amber-900">Facilități <strong className="float-right">{facilityCount}</strong></div></div>}
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
              {add.length > 0 && <div className="mt-2"><div className="text-[11px] font-semibold text-blue-700">De verificat și adăugat</div><div className="mt-1 flex flex-wrap gap-1.5">{add.map((id) => <span key={id} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">{serviceLabel(id)}</span>)}</div></div>}
              {remove.length > 0 && <div className="mt-2"><div className="text-[11px] font-semibold text-red-700">De eliminat</div><div className="mt-1 flex flex-wrap gap-1.5">{remove.map((id) => <span key={id} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800">{serviceLabel(id)}</span>)}</div></div>}
            </div>
          );
        })}
        {suggestions.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="text-xs font-bold text-amber-900">Propuneri pentru catalog</div><div className="mt-2 flex flex-wrap gap-1.5">{suggestions.map((item, index) => <span key={`${item.label}-${index}`} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">{item.label}</span>)}</div></div>}
      </div>
      <PrerequisiteChecklist review={review} />
    </>
  );
}

function TeamPreview({ payload }) {
  const invitations = payload.invitations || [];
  const members = payload.members || [];
  return <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/20 p-3">{[...invitations, ...members].length > 0 ? <>{invitations.map((item, index) => <div key={`${item.email}-${index}`} className="text-xs"><strong>{roleLabel(item.professional_role)}</strong> · {item.email}</div>)}{members.map((item, index) => <div key={`${item.full_name}-${index}`} className="text-xs"><strong>{item.full_name}</strong> · {roleLabel(item.professional_type)}</div>)}</> : <p className="text-xs text-muted-foreground">Nu există specialiști în payload.</p>}</div>;
}

function Comparison({ submission, location }) {
  const payload = parsePayload(submission.payload_json);
  if (submission.section === "location_details") return <FieldComparison fields={LOCATION_FIELDS} payload={payload} current={location} />;
  if (submission.section === "public_profile") return <FieldComparison fields={PUBLIC_PROFILE_FIELDS} payload={payload} current={location} />;
  if (submission.section === "services") return <ServicesPreview payload={payload} review={submission.prerequisite_review} />;
  if (submission.section === "team") return <TeamPreview payload={payload} />;
  return <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-secondary/40 p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>;
}

function SubmissionCard({ submission, location, busy, onDecision }) {
  const [note, setNote] = useState("");
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const locationName = location?.public_display_name || location?.name || "Locație necunoscută";
  const title = payload.public_display_name || payload.title || locationName;
  const blocked = submission.section === "services" && submission.prerequisite_review?.approval_allowed === false;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{title}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SECTION_LABELS[submission.section] || submission.section}</span></div><p className="mt-1 text-xs text-muted-foreground">{locationName} · trimisă {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("ro-RO") : "la o dată necunoscută"}</p></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${blocked ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{blocked ? "Cerințe lipsă" : "În verificare"}</span></div>
      <Comparison submission={submission} location={location} />
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Notă admin. Obligatorie pentru respingere sau cerere de informații." rows={2} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || blocked} onClick={() => onDecision(submission, "approve", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" /> Aprobă</button><button disabled={busy} onClick={() => onDecision(submission, "request_more_info", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"><Info className="h-3.5 w-3.5" /> Cere informații</button><button disabled={busy} onClick={() => onDecision(submission, "reject", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Respinge</button></div>
    </div>
  );
}

export default function AdminWorkspaceSubmissionsReview() {
  const [submissions, setSubmissions] = useState(null);
  const [locations, setLocations] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const [pendingResponse, locationRows] = await Promise.all([
      base44.functions.invoke("adminServiceConfigurationReview", { action: "list", status: "pending_review" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
      base44.entities.ProviderLocation.list("name", 500).catch(() => []),
    ]);
    if (pendingResponse.data?.error) setError(pendingResponse.data.error);
    const pending = pendingResponse.data?.submissions || [];
    const enriched = await Promise.all(pending.map(async (submission) => {
      if (submission.section !== "services") return submission;
      const detail = await base44.functions.invoke("adminServiceConfigurationReview", { action: "get", submission_id: submission.id }).catch(() => ({ data: {} }));
      return { ...submission, prerequisite_review: detail.data?.prerequisite_review || null };
    }));
    setSubmissions(enriched);
    setLocations(Object.fromEntries(locationRows.map((location) => [location.id, location])));
  };

  useEffect(() => { load(); }, []);

  const decide = async (submission, action, note) => {
    setBusy(true);
    setError("");
    try {
      const response = await base44.functions.invoke("adminServiceConfigurationReview", { action, submission_id: submission.id, note: note || "" });
      if (response.data?.error) throw new Error(response.data.error);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "Nu am putut procesa decizia.");
    } finally {
      setBusy(false);
    }
  };

  if (!submissions) return <p className="text-sm text-muted-foreground">Se încarcă modificările workspace...</p>;
  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-base font-bold">Modificări workspace în verificare</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Serviciile sunt verificate împreună cu spațiul, capabilitatea, specialistul, echipamentul și infrastructura în care sunt realizate.</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{submissions.length} în așteptare</span></div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="mt-4 space-y-3">{submissions.length === 0 ? <EmptyState icon={ClipboardCheck} title="Nu există modificări în verificare." subtitle="Cererile trimise de furnizori vor apărea aici." /> : submissions.map((submission) => <SubmissionCard key={submission.id} submission={submission} location={locations[submission.location_id]} busy={busy} onDecision={decide} />)}</div>
    </AdminCard>
  );
}
