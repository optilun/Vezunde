import React, { useEffect, useMemo, useState } from "react";
import { Filter, History, Search, User, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const ACTION_LABELS = {
  create_organization: "Organizatie creata",
  create_directory_location: "Locatie creata in director",
  verify_profile: "Profil verificat",
  suspend_profile: "Profil suspendat",
  approve_claim: "Revendicare aprobata",
  reject_claim: "Revendicare respinsa",
  create_draft: "Draft creat",
  update_draft: "Draft actualizat",
  submit_for_review: "Trimis spre verificare",
  approve_submission: "Cerere aprobata",
  reject_submission: "Cerere respinsa",
  request_more_info: "Completari solicitate",
  apply_workspace_submission: "Datele locatiei au fost aplicate",
  apply_services_submission: "Serviciile au fost aplicate",
  approve_organization_profile: "Profilul organizatiei a fost aprobat",
  create_organization_profile_draft: "Draft organizational creat",
  submit_organization_profile_review: "Profil organizational trimis spre verificare",
  create_location_photo_draft: "Draft fotografie creat",
  submit_location_photo_review: "Fotografie trimisa spre verificare",
  approve_location_photo: "Fotografie aprobata",
  backfill_matching_allowed: "Eligibilitatea pentru matching a fost recalculata",
  provider_fast_path_schedule_update: "Program actualizat de furnizor",
  provider_fast_path_routine_update: "Date curente actualizate de furnizor",
  preserve_legacy_location_logo: "Logo legacy pastrat in profilul organizatiei",
  demo_cleanup_manifest: "Curatare date demo",
};

const ENTITY_LABELS = {
  ProviderOrganization: "Organizatie",
  ProviderLocation: "Locatie",
  ProviderWorkspaceSubmission: "Cerere workspace",
  ProviderClaimRequest: "Revendicare",
  LocationService: "Serviciu",
  ProfessionalProfile: "Specialist",
  DemoCleanup: "Sistem",
};

const FIELD_LABELS = {
  public_display_name: "nume public",
  public_description: "descriere",
  public_phone: "telefon public",
  public_email: "email public",
  website_url: "website",
  facebook_url: "Facebook",
  instagram_url: "Instagram",
  linkedin_url: "LinkedIn",
  address: "adresa",
  lat: "latitudine",
  lng: "longitudine",
  place_id: "pozitie Google Maps",
  photo_url: "fotografie",
  opening_hours: "program",
  opening_hours_json: "program structurat",
  profile_control_status: "status control profil",
  claim_verification_status: "status revendicare",
  matching_allowed: "eligibilitate matching",
  services: "servicii",
  status: "status",
};

function actionLabel(value) {
  return ACTION_LABELS[value] || String(value || "Actiune").replaceAll("_", " ");
}

function entityLabel(value) {
  return ENTITY_LABELS[value] || value || "Entitate";
}

function actorType(record) {
  const email = String(record.admin_email || "").toLowerCase();
  if (!email || email.includes("system") || record.admin_user_id === null) return "system";
  if (record.action_type?.startsWith("provider_") || record.action_type?.includes("draft") || record.action_type === "submit_for_review" || record.action_type === "submit_location_photo_review" || record.action_type === "submit_organization_profile_review") return "provider";
  return "admin";
}

function actorLabel(record) {
  const type = actorType(record);
  if (type === "system") return "Sistem";
  if (type === "provider") return record.admin_email || "Furnizor";
  return record.admin_email || "Administrator";
}

function formatDay(value) {
  if (!value) return "Data necunoscuta";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data necunoscuta";
  return date.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function changedFields(record) {
  return (record.changed_fields || []).map((field) => FIELD_LABELS[field] || field.replaceAll("_", " "));
}

function AuditRow({ record }) {
  const fields = changedFields(record);
  const type = actorType(record);
  return (
    <div className="border-b border-border/70 py-3 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-bold">{actionLabel(record.action_type)}</div>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{entityLabel(record.entity_type)}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {actorLabel(record)}</span>
            <span>{type === "admin" ? "Actiune admin" : type === "provider" ? "Actiune furnizor" : "Actiune sistem"}</span>
            {fields.length > 0 && <span>{fields.join(", ")}</span>}
          </div>
          {record.note && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{record.note}</p>}
        </div>
        <div className="shrink-0 text-xs font-semibold text-muted-foreground">{formatTime(record.performed_at)}</div>
      </div>
      {(record.previous_values || record.new_values || record.entity_id) && (
        <details className="mt-2 rounded-xl border border-border bg-secondary/25">
          <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">Detalii tehnice</summary>
          <div className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <div>Referinta entitate: {record.entity_id || "lipsa"}</div>
            {record.previous_values && record.previous_values !== "{}" && <div className="mt-1 break-all">Inainte: {record.previous_values}</div>}
            {record.new_values && record.new_values !== "{}" && <div className="mt-1 break-all">Dupa: {record.new_values}</div>}
          </div>
        </details>
      )}
    </div>
  );
}

export default function DirOpsAudit() {
  const [records, setRecords] = useState(null);
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("all");
  const [entity, setEntity] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    base44.entities.DirectoryAuditRecord.list("-created_date", 500)
      .then(setRecords)
      .catch((reason) => {
        setError(reason.response?.data?.error || reason.message || "Nu am putut incarca istoricul.");
        setRecords([]);
      });
  }, []);

  const entityOptions = useMemo(() => [...new Set((records || []).map((record) => record.entity_type).filter(Boolean))].sort(), [records]);
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (records || []).filter((record) => {
      if (actor !== "all" && actorType(record) !== actor) return false;
      if (entity !== "all" && record.entity_type !== entity) return false;
      if (!normalizedQuery) return true;
      return [actionLabel(record.action_type), entityLabel(record.entity_type), record.admin_email, record.note, ...(record.changed_fields || [])]
        .some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [actor, entity, query, records]);

  const grouped = useMemo(() => {
    const output = new Map();
    for (const record of visible) {
      const day = formatDay(record.performed_at || record.created_date);
      if (!output.has(day)) output.set(day, []);
      output.get(day).push(record);
    }
    return [...output.entries()];
  }, [visible]);

  return (
    <div className="space-y-4">
      <AdminCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_220px]">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cauta actiune, utilizator sau camp" className="w-full bg-transparent text-xs outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={actor} onChange={(event) => setActor(event.target.value)} className="w-full bg-transparent text-xs outline-none">
              <option value="all">Toti actorii</option>
              <option value="admin">Administratori</option>
              <option value="provider">Furnizori</option>
              <option value="system">Sistem</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <select value={entity} onChange={(event) => setEntity(event.target.value)} className="w-full bg-transparent text-xs outline-none">
              <option value="all">Toate entitatile</option>
              {entityOptions.map((item) => <option key={item} value={item}>{entityLabel(item)}</option>)}
            </select>
          </label>
        </div>
        {records && <p className="mt-3 text-xs text-muted-foreground">{visible.length} din {records.length} evenimente afisate. Valorile tehnice sunt ascunse implicit.</p>}
      </AdminCard>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {!records && <p className="text-sm text-muted-foreground">Se incarca...</p>}
      {records && visible.length === 0 && <AdminCard className="p-5"><EmptyState icon={History} title="Nu exista evenimente pentru filtrele selectate." subtitle="Schimba filtrele sau termenul de cautare." /></AdminCard>}

      {grouped.map(([day, dayRecords]) => (
        <AdminCard key={day} className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/25 px-5 py-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{day}</h3>
            <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold">{dayRecords.length}</span>
          </div>
          <div className="px-5">{dayRecords.map((record) => <AuditRow key={record.id} record={record} />)}</div>
        </AdminCard>
      ))}
    </div>
  );
}
