import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Info, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

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

function parsePayload(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function valueText(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return `${value.length} elemente`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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

function JsonPreview({ payload }) {
  return <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-border bg-secondary/40 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>;
}

function Comparison({ submission, location }) {
  const payload = parsePayload(submission.payload_json);
  if (submission.section === "location_details") return <FieldComparison fields={LOCATION_FIELDS} payload={payload} current={location} />;
  if (submission.section === "public_profile") return <FieldComparison fields={PUBLIC_PROFILE_FIELDS} payload={payload} current={location} />;
  return <JsonPreview payload={payload} />;
}

function SubmissionCard({ submission, location, busy, onDecision }) {
  const [note, setNote] = useState("");
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const locationName = location?.public_display_name || location?.name || "Locatie necunoscuta";
  const title = payload.public_display_name || payload.title || locationName;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-heading text-sm font-bold">{title}</h3><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">{SECTION_LABELS[submission.section] || submission.section}</span></div>
          <p className="mt-1 text-xs text-muted-foreground">{locationName} · trimisa {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString("ro-RO") : "data necunoscuta"}</p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">In review</span>
      </div>
      <Comparison submission={submission} location={location} />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota admin. Obligatorie pentru respingere sau cerere de informatii." rows={2} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onDecision(submission, "approve", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Aproba</button>
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
      base44.functions.invoke("adminWorkspaceReview", { action: "list", status: "pending_review" }).catch((e) => ({ data: { error: e.response?.data?.error || e.message, submissions: [] } })),
      base44.entities.ProviderLocation.list("name", 500).catch(() => []),
    ]);
    if (pendingRes.data?.error) setError(pendingRes.data.error);
    setSubmissions(pendingRes.data?.submissions || []);
    setLocations(Object.fromEntries(locs.map((l) => [l.id, l])));
  };

  useEffect(() => { load(); }, []);

  const decide = async (submission, action, note) => {
    setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("adminWorkspaceReview", {
        action,
        submission_id: submission.id,
        note: note || "",
      });
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
        <div><h2 className="font-heading text-base font-bold">Modificari workspace in review</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Aici apar modificarile trimise de furnizori: profil public, date locatie, servicii si specialisti. Programul se aplica separat prin update rapid.</p></div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{submissions.length} in asteptare</span>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="mt-4 space-y-3">
        {submissions.length === 0 ? <EmptyState icon={ClipboardCheck} title="Nu exista modificari workspace in review." subtitle="Cererile trimise de furnizori vor aparea aici." /> : submissions.map((s) => <SubmissionCard key={s.id} submission={s} location={locations[s.location_id]} busy={busy} onDecision={decide} />)}
      </div>
    </AdminCard>
  );
}
