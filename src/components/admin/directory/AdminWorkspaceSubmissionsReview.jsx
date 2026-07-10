import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info, ShieldCheck, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { SERVICE_GROUPS } from "@/lib/canonicalServiceCatalog";

const SECTION_LABELS = {
  public_profile: "Profil public",
  location_details: "Date locatie",
  operating_hours: "Program",
  services: "Servicii",
  team: "Specialisti",
  media: "Media",
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
  ["public_display_name", "Nume public"],
  ["public_description", "Descriere"],
  ["public_phone", "Telefon public"],
  ["public_email", "Email public"],
  ["website_url", "Website"],
  ["facebook_url", "Facebook"],
  ["instagram_url", "Instagram"],
  ["linkedin_url", "LinkedIn"],
];

const SERVICE_GROUP_LABELS = {
  patient_services: "Servicii pentru pacienti",
  investigations: "Investigatii",
  specialties: "Specializari / proceduri",
  technical_activities: "Servicii tehnice",
};

const SERVICE_LABELS = Object.values(SERVICE_GROUPS || {}).reduce((acc, group) => ({ ...acc, ...(group.ids || {}) }), {});

function parsePayload(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function valueText(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return `${value.length} elemente`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function serviceLabel(id) {
  return SERVICE_LABELS[id] || id;
}

function roleLabel(role) {
  const roles = {
    ophthalmologist: "Medic oftalmolog",
    optometrist: "Optometrist",
    optician: "Optician / specialist optica",
    contact_lens_specialist: "Specialist lentile de contact",
    optical_workshop_specialist: "Specialist atelier optic",
    other_specialist: "Alt specialist relevant",
    other_relevant_specialist: "Alt specialist relevant",
  };
  return roles[role] || role || "Specialist";
}

function FieldComparison({ fields, payload, current }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/60 text-muted-foreground"><tr><th className="px-3 py-2">Camp</th><th className="px-3 py-2">Publicat acum</th><th className="px-3 py-2">Propus</th></tr></thead>
        <tbody className="divide-y divide-border">
          {fields.map(([key, label]) => (
            <tr key={key}>
              <td className="px-3 py-2 font-semibold">{label}</td>
              <td className="px-3 py-2 text-muted-foreground">{valueText(current?.[key])}</td>
              <td className="px-3 py-2 font-medium">{Object.prototype.hasOwnProperty.call(payload, key) ? valueText(payload[key]) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrerequisiteChecklist({ review }) {
  if (!review) return null;
  const services = review.services || [];
  return (
    <div className={`mt-3 rounded-xl border p-3 ${review.approval_allowed ? "border-green-200 bg-green-50/70" : "border-amber-200 bg-amber-50/80"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {review.approval_allowed ? <ShieldCheck className="h-4 w-4 text-green-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}
          <div className="text-xs font-bold">Verificarea cerintelor serviciilor</div>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold">
          {review.summary?.eligible_count || 0}/{review.summary?.selected_count || 0} eligibile
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {services.map((service) => (
          <div key={service.service_key} className="rounded-lg border border-black/5 bg-white p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold">{service.label || serviceLabel(service.service_key)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${service.eligible ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
                {service.status_label || service.status}
              </span>
            </div>
            {!service.eligible && (
              <div className="mt-1.5 space-y-1">
                {(service.blockers || []).map((blocker, index) => (
                  <p key={`${blocker.code}-${index}`} className="text-[11px] leading-relaxed text-amber-900">• {blocker.message}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {!review.approval_allowed && <p className="mt-2 text-[11px] font-semibold text-amber-900">Aprobarea este blocata pana cand toate cerintele sunt indeplinite.</p>}
    </div>
  );
}

function ServicesPreview({ payload, prerequisiteReview }) {
  const selected = payload.selected_ids || {};
  const removals = payload.removal_ids || {};
  const suggestions = payload.suggestions || payload.custom_requests || [];
  const groups = [...new Set([...Object.keys(selected), ...Object.keys(removals)])];
  const hasSelected = Object.values(selected).some((items) => Array.isArray(items) && items.length > 0);
  const hasRemovals = Object.values(removals).some((items) => Array.isArray(items) && items.length > 0);
  const hasSuggestions = Array.isArray(suggestions) && suggestions.length > 0;

  if (!hasSelected && !hasRemovals && !hasSuggestions) {
    return <p className="mt-3 rounded-xl border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">Nu exista servicii in payload.</p>;
  }

  return (
    <>
      <div className="mt-3 space-y-3 rounded-xl border border-border bg-secondary/20 p-3">
        {groups.map((group) => {
          const add = selected[group] || [];
          const remove = removals[group] || [];
          if (add.length === 0 && remove.length === 0) return null;
          return (
            <div key={group} className="rounded-xl border border-border bg-card p-3">
              <div className="text-xs font-bold text-foreground">{SERVICE_GROUP_LABELS[group] || group}</div>
              {add.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] font-semibold text-blue-700">De verificat si adaugat</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {add.map((id) => <span key={id} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">{serviceLabel(id)}</span>)}
                  </div>
                </div>
              )}
              {remove.length > 0 && (
                <div className="mt-2">
                  <div className="text-[11px] font-semibold text-red-700">De eliminat</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {remove.map((id) => <span key={id} className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800">{serviceLabel(id)}</span>)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {hasSuggestions && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-bold text-amber-900">Servicii propuse manual</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((item, idx) => (
                <span key={`${item.label}-${idx}`} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900">
                  {item.label} {item.group ? `· ${SERVICE_GROUP_LABELS[item.group] || item.group}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <PrerequisiteChecklist review={prerequisiteReview} />
    </>
  );
}

function TeamPreview({ payload }) {
  const invitations = payload.invitations || (payload.members || []).filter((m) => m.invite_email).map((m) => ({ email: m.invite_email, professional_role: m.professional_type }));
  const members = (payload.members || []).filter((m) => !m.invite_email);
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-secondary/20 p-3">
      {invitations.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs font-bold">Invitatii specialisti</div>
          <div className="mt-2 space-y-1.5">
            {invitations.map((item, idx) => <div key={`${item.email}-${idx}`} className="text-xs"><span className="font-semibold">{roleLabel(item.professional_role)}</span> · <span className="text-muted-foreground">{item.email}</span></div>)}
          </div>
        </div>
      )}
      {members.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-xs font-bold">Specialisti publici</div>
          <div className="mt-2 space-y-1.5">
            {members.map((item, idx) => <div key={`${item.full_name}-${idx}`} className="text-xs"><span className="font-semibold">{item.full_name}</span> · <span className="text-muted-foreground">{roleLabel(item.professional_type)}</span></div>)}
          </div>
        </div>
      )}
      {invitations.length === 0 && members.length === 0 && <p className="text-xs text-muted-foreground">Nu exista specialisti in payload.</p>}
    </div>
  );
}

function JsonPreview({ payload }) {
  return <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-secondary/40 p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>;
}

function Comparison({ submission, location }) {
  const payload = parsePayload(submission.payload_json);
  if (submission.section === "location_details") return <FieldComparison fields={LOCATION_FIELDS} payload={payload} current={location} />;
  if (submission.section === "public_profile") return <FieldComparison fields={PUBLIC_PROFILE_FIELDS} payload={payload} current={location} />;
  if (submission.section === "services") return <ServicesPreview payload={payload} prerequisiteReview={submission.prerequisite_review} />;
  if (submission.section === "team") return <TeamPreview payload={payload} />;
  return <JsonPreview payload={payload} />;
}

function SubmissionCard({ submission, location, busy, onDecision }) {
  const [note, setNote] = useState("");
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const locationName = location?.public_display_name || location?.name || "Locatie necunoscuta";
  const title = payload.public_display_name || payload.title || locationName;
  const approvalBlocked = submission.section === "services" && submission.prerequisite_review?.approval_allowed === false;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-sm font-bold">{title}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SECTION_LABELS[submission.section] || submission.section}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{locationName} · trimisa {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("ro-RO") : "data necunoscuta"}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${approvalBlocked ? "border-amber-200 bg-amber-50 text-amber-800" : "border-blue-200 bg-blue-50 text-blue-800"}`}>{approvalBlocked ? "Cerinte lipsa" : "In review"}</span>
      </div>
      <Comparison submission={submission} location={location} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota admin. Obligatorie pentru respingere sau cerere de informatii." rows={2} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy || approvalBlocked} onClick={() => onDecision(submission, "approve", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" /> Aproba</button>
        <button disabled={busy} onClick={() => onDecision(submission, "request_more_info", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"><Info className="h-3.5 w-3.5" /> Cere informatii</button>
        <button disabled={busy} onClick={() => onDecision(submission, "reject", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Respinge</button>
      </div>
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
    const [pendingRes, locs] = await Promise.all([
      base44.functions.invoke("adminServicePrerequisiteReview", { action: "list", status: "pending_review" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message, submissions: [] } })),
      base44.entities.ProviderLocation.list("name", 500).catch(() => []),
    ]);
    if (pendingRes.data?.error) setError(pendingRes.data.error);
    const pending = pendingRes.data?.submissions || [];
    const enriched = await Promise.all(pending.map(async (submission) => {
      if (submission.section !== "services") return submission;
      const detail = await base44.functions.invoke("adminServicePrerequisiteReview", { action: "get", submission_id: submission.id }).catch(() => ({ data: {} }));
      return { ...submission, prerequisite_review: detail.data?.prerequisite_review || null };
    }));
    setSubmissions(enriched);
    setLocations(Object.fromEntries(locs.map((location) => [location.id, location])));
  };

  useEffect(() => { load(); }, []);

  const decide = async (submission, action, note) => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("adminServicePrerequisiteReview", { action, submission_id: submission.id, note: note || "" });
      if (res.data?.error) throw new Error(res.data.error);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Nu am putut procesa decizia.");
    } finally {
      setBusy(false);
    }
  };

  if (!submissions) return <p className="text-sm text-muted-foreground">Se incarca modificarile workspace...</p>;

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="font-heading text-base font-bold">Modificari workspace in review</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Aprobarea serviciilor medicale este permisa numai dupa verificarea locatiei, specialistului, echipamentului si infrastructurii necesare.</p></div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{submissions.length} in asteptare</span>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="mt-4 space-y-3">
        {submissions.length === 0 ? <EmptyState icon={ClipboardCheck} title="Nu exista modificari workspace in review." subtitle="Cererile trimise de furnizori vor aparea aici." /> : submissions.map((submission) => <SubmissionCard key={submission.id} submission={submission} location={locations[submission.location_id]} busy={busy} onDecision={decide} />)}
      </div>
    </AdminCard>
  );
}
