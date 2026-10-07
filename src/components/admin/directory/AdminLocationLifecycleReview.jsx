import React, { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, EyeOff, Info, RotateCcw, TriangleAlert, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fetchByIds, fetchWhereIn, uniqueIds } from "@/lib/adminEntityBatch";
import { locationStatusLabel, publicVisibilityLabel } from "@/lib/adminLabels";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";

const ACTIONS = {
  hide: {
    label: "Ascundere temporară",
    description: "Locația rămâne activă în workspace, dar este retrasă din paginile publice.",
    icon: EyeOff,
  },
  republish: {
    label: "Republicare",
    description: "Locația revine în căutare și pe profilul public după aprobare.",
    icon: RotateCcw,
  },
  close: {
    label: "Închidere și arhivare",
    description: "Locația devine inactivă, nu mai primește cereri și este retrasă din director.",
    icon: Archive,
  },
};

function parsePayload(raw) {
  try { return JSON.parse(raw || "{}") || {}; } catch { return {}; }
}

function locationName(location) {
  return location?.public_display_name || location?.name || "Locație necunoscută";
}

function organizationName(organization) {
  return organization?.public_display_name || organization?.name || "Organizație necunoscută";
}

// `activeLocationCount`: număr, sau null când nu s-a putut afla (atunci cerem verificare manuală, în
// loc să afirmăm ceva fals despre „ultima locație”).
function RequestCard({ submission, location, organization, activeLocationCount, busy, onDecision }) {
  const [note, setNote] = useState("");
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const definition = ACTIONS[payload.action] || { label: payload.action || "Schimbare de stare", description: "Solicitare de schimbare a stării locației.", icon: Info };
  const Icon = definition.icon;
  const isClose = payload.action === "close";
  const countKnown = Number.isFinite(activeLocationCount);
  const closesLastLocation = isClose && countKnown && activeLocationCount <= 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold">{definition.label}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{locationName(location)} · {organizationName(organization)}</p>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">{definition.description}</p>
          </div>
        </div>
        <StatusBadge label="În verificare" tone="info" />
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-border bg-secondary/25 p-3 text-xs sm:grid-cols-3">
        <div><span className="text-muted-foreground">Stare curentă</span><div className="mt-1 font-semibold">{locationStatusLabel(location?.status)}</div></div>
        <div><span className="text-muted-foreground">Vizibilitate</span><div className="mt-1 font-semibold">{publicVisibilityLabel(location?.public_visibility_status)}</div></div>
        <div><span className="text-muted-foreground">Locații active în organizație</span><div className="mt-1 font-semibold">{countKnown ? activeLocationCount : "—"}</div></div>
      </div>

      {closesLastLocation && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-xs leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Aprobarea va arhiva și profilul public al organizației, deoarece aceasta este ultima locație activă.</span>
        </div>
      )}
      {isClose && !countKnown && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning-border bg-warning-soft p-3 text-xs leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Nu am putut număra locațiile active ale organizației. Verifică înainte să aprobi: dacă e ultima, se arhivează și profilul organizației.</span>
        </div>
      )}

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Notă admin. Obligatorie pentru respingere sau cerere de informații."
        aria-label="Notă admin"
        rows={2}
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onDecision(submission, "approve", note)} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Aprobă</button>
        <button disabled={busy} onClick={() => onDecision(submission, "request_more_info", note)} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"><Info className="h-3.5 w-3.5" aria-hidden="true" /> Cere informații</button>
        <button disabled={busy} onClick={() => onDecision(submission, "reject", note)} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-danger disabled:opacity-50"><XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Respinge</button>
      </div>
    </div>
  );
}

// 2026-10-07 (audit admin): nu mai citeste primele 1.000 de locatii dupa nume (directorul are ~1.600,
// deci numele lipseau si numarul de „locatii active” iesea gresit, cu avertisment fals pentru
// „ultima locatie”). Se citesc doar locatiile cererilor si cele ale organizatiilor lor.
export default function AdminLocationLifecycleReview() {
  const { refresh: refreshCounts } = useAdminCounts();
  const [submissions, setSubmissions] = useState(null);
  const [locations, setLocations] = useState({});
  const [organizations, setOrganizations] = useState({});
  const [siblings, setSiblings] = useState({ rows: [], failed: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const response = await base44.functions.invoke("providerLocationLifecycleOps", { action: "admin_list" })
      .catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } }));
    if (response.data?.error) setError(response.data.error);
    const rows = response.data?.submissions || [];
    setSubmissions(rows);

    const organizationIds = uniqueIds(rows.map((row) => row.organization_id));
    const [locationResult, organizationResult, siblingResult] = await Promise.all([
      fetchByIds(base44.entities.ProviderLocation, rows.map((row) => row.location_id)),
      fetchByIds(base44.entities.ProviderOrganization, organizationIds),
      fetchWhereIn(base44.entities.ProviderLocation, "organization_id", organizationIds),
    ]);
    setLocations(locationResult.byId);
    setOrganizations(organizationResult.byId);
    setSiblings({ rows: siblingResult.rows, failed: siblingResult.failed });
    if (locationResult.failed || organizationResult.failed) {
      setError((current) => [current, "Unele nume de locații sau organizații nu s-au putut încărca."].filter(Boolean).join(" "));
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (submission, action, note) => {
    setBusy(true);
    setError("");
    try {
      const response = await base44.functions.invoke("providerLocationLifecycleOps", {
        action,
        submission_id: submission.id,
        note: note || "",
      });
      if (response.data?.error) throw new Error(response.data.error);
      await load();
      refreshCounts();
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "Nu am putut procesa decizia.");
    } finally {
      setBusy(false);
    }
  };

  const activeCountByOrganization = useMemo(() => {
    if (siblings.failed) return null;
    return siblings.rows.reduce((accumulator, location) => {
      if (!location.organization_id || location.active_status === "inactiva") return accumulator;
      accumulator[location.organization_id] = (accumulator[location.organization_id] || 0) + 1;
      return accumulator;
    }, {});
  }, [siblings]);

  if (!submissions) return <AdminLoading label="Se încarcă solicitările…" />;

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-base font-bold">Schimbări de stare a locațiilor</h2>
        <StatusBadge label={`${submissions.length} în așteptare`} />
      </div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 space-y-3">
        {submissions.length === 0 ? (
          <EmptyState icon={Archive} title="Nu există solicitări de acest fel." subtitle="Cererile trimise de proprietari vor apărea aici." />
        ) : submissions.map((submission) => (
          <RequestCard
            key={submission.id}
            submission={submission}
            location={locations[submission.location_id]}
            organization={organizations[submission.organization_id]}
            activeLocationCount={activeCountByOrganization ? (activeCountByOrganization[submission.organization_id] || 0) : null}
            busy={busy}
            onDecision={decide}
          />
        ))}
      </div>
    </AdminCard>
  );
}
