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
  team: "Echipa",
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

function parsePayload(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

function valueText(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function locationUpdateFromPayload(payload) {
  const update = {};
  ["public_display_name", "address", "public_phone", "public_email", "place_id"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) update[key] = payload[key] || null;
  });
  ["lat", "lng"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      const n = toNumberOrNull(payload[key]);
      if (n !== undefined) update[key] = n;
    }
  });
  return update;
}

function Comparison({ submission, location }) {
  const payload = parsePayload(submission.payload_json);
  if (submission.section !== "location_details") {
    return <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-border bg-secondary/40 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(payload, null, 2)}</pre>;
  }
  const lat = toNumberOrNull(payload.lat);
  const lng = toNumberOrNull(payload.lng);
  const partialCoords = (lat !== null && lat !== undefined && (lng === null || lng === undefined)) || (lng !== null && lng !== undefined && (lat === null || lat === undefined));
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      {partialCoords && <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Coordonatele sunt incomplete. Harta va folosi adresa pana exista si latitudine, si longitudine.</div>}
      <table className="w-full text-left text-xs">
        <thead className="bg-secondary/60 text-muted-foreground"><tr><th className="px-3 py-2">Camp</th><th className="px-3 py-2">Publicat acum</th><th className="px-3 py-2">Propus</th></tr></thead>
        <tbody className="divide-y divide-border">
          {LOCATION_FIELDS.map(([key, label]) => (
            <tr key={key}>
              <td className="px-3 py-2 font-semibold">{label}</td>
              <td className="px-3 py-2 text-muted-foreground">{valueText(location?.[key])}</td>
              <td className="px-3 py-2 font-medium">{Object.prototype.hasOwnProperty.call(payload, key) ? valueText(payload[key]) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubmissionCard({ submission, location, busy, onDecision }) {
  const [note, setNote] = useState("");
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const locationName = location?.public_display_name || location?.name || "Locatie necunoscuta";
  const title = payload.public_display_name || locationName;
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
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota admin, optional" rows={2} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onDecision(submission, "approved", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Aproba</button>
        <button disabled={busy} onClick={() => onDecision(submission, "needs_more_info", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"><Info className="h-3.5 w-3.5" /> Cere informatii</button>
        <button disabled={busy} onClick={() => onDecision(submission, "rejected", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Respinge</button>
      </div>
    </div>
  );
}

export default function AdminWorkspaceSubmissionsReview() {
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [locations, setLocations] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const [me, pending, locs] = await Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.ProviderWorkspaceSubmission.filter({ status: "pending_review" }, "-submitted_at", 200).catch(() => []),
      base44.entities.ProviderLocation.list("name", 500).catch(() => []),
    ]);
    setUser(me);
    setSubmissions(pending);
    setLocations(Object.fromEntries(locs.map((l) => [l.id, l])));
  };

  useEffect(() => { load(); }, []);

  const decide = async (submission, status, note) => {
    setBusy(true);
    setError("");
    try {
      if (status === "approved" && submission.section === "location_details") {
        const update = locationUpdateFromPayload(parsePayload(submission.payload_json));
        if (Object.keys(update).length > 0) await base44.entities.ProviderLocation.update(submission.location_id, update);
      }
      await base44.entities.ProviderWorkspaceSubmission.update(submission.id, {
        status,
        admin_note: note || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: user?.id || null,
      });
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
        <div><h2 className="font-heading text-base font-bold">Modificari workspace in review</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Aici apar modificarile trimise de furnizori: profil public, date locatie, program, servicii, echipa, media si articole.</p></div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{submissions.length} in asteptare</span>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="mt-4 space-y-3">
        {submissions.length === 0 ? <EmptyState icon={ClipboardCheck} title="Nu exista modificari workspace in review." subtitle="Cererile trimise de furnizori vor aparea aici." /> : submissions.map((s) => <SubmissionCard key={s.id} submission={s} location={locations[s.location_id]} busy={busy} onDecision={decide} />)}
      </div>
    </AdminCard>
  );
}
