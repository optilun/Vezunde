import React, { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, EyeOff, Info, RotateCcw, TriangleAlert, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

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

function RequestCard({ submission, location, organization, activeLocationCount, busy, onDecision }) {
  const [note, setNote] = useState("");
  const payload = useMemo(() => parsePayload(submission.payload_json), [submission.payload_json]);
  const definition = ACTIONS[payload.action] || { label: payload.action || "Schimbare stare", description: "Solicitare de schimbare a stării locației.", icon: Info };
  const Icon = definition.icon;
  const closesLastLocation = payload.action === "close" && activeLocationCount <= 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold">{definition.label}</h3>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">Stare locație</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{locationName(location)} · {organizationName(organization)}</p>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">{definition.description}</p>
          </div>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-800">În verificare</span>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-border bg-secondary/25 p-3 text-xs sm:grid-cols-3">
        <div><span className="text-muted-foreground">Status curent</span><div className="mt-1 font-semibold">{location?.status || "-"}</div></div>
        <div><span className="text-muted-foreground">Vizibilitate</span><div className="mt-1 font-semibold">{location?.public_visibility_status || "-"}</div></div>
        <div><span className="text-muted-foreground">Locații active în organizație</span><div className="mt-1 font-semibold">{activeLocationCount}</div></div>
      </div>

      {closesLastLocation && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Aprobarea va arhiva și profilul public al organizației, deoarece aceasta este ultima locație activă.</span>
        </div>
      )}

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Notă admin. Obligatorie pentru respingere sau cerere de informații."
        rows={2}
        className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => onDecision(submission, "approve", note)} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40"><CheckCircle2 className="h-3.5 w-3.5" /> Aprobă</button>
        <button disabled={busy} onClick={() => onDecision(submission, "request_more_info", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold disabled:opacity-50"><Info className="h-3.5 w-3.5" /> Cere informații</button>
        <button disabled={busy} onClick={() => onDecision(submission, "reject", note)} className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-destructive disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> Respinge</button>
      </div>
    </div>
  );
}

export default function AdminLocationLifecycleReview() {
  const [submissions, setSubmissions] = useState(null);
  const [locations, setLocations] = useState({});
  const [organizations, setOrganizations] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const [response, locationRows, organizationRows] = await Promise.all([
      base44.functions.invoke("providerLocationLifecycleOps", { action: "admin_list" }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message, submissions: [] } })),
      base44.entities.ProviderLocation.list("name", 1000).catch(() => []),
      base44.entities.ProviderOrganization.list("name", 5000).catch(() => []),
    ]);
    if (response.data?.error) setError(response.data.error);
    setSubmissions(response.data?.submissions || []);
    setLocations(Object.fromEntries(locationRows.map((location) => [location.id, location])));
    setOrganizations(Object.fromEntries(organizationRows.map((organization) => [organization.id, organization])));
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
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || "Nu am putut procesa decizia.");
    } finally {
      setBusy(false);
    }
  };

  if (!submissions) return <p className="text-sm text-muted-foreground">Se încarcă solicitările privind starea locațiilor...</p>;

  const activeCountByOrganization = Object.values(locations).reduce((accumulator, location) => {
    if (!location.organization_id || location.active_status === "inactiva") return accumulator;
    accumulator[location.organization_id] = (accumulator[location.organization_id] || 0) + 1;
    return accumulator;
  }, {});

  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold">Solicitări privind starea locațiilor</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Aprobă ascunderea temporară, republicarea sau închiderea unei locații. Decizia actualizează datele publice și este păstrată în audit.</p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">{submissions.length} în așteptare</span>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="mt-4 space-y-3">
        {submissions.length === 0 ? (
          <EmptyState icon={Archive} title="Nu există solicitări privind starea locațiilor." subtitle="Cererile trimise de owneri vor apărea aici." ctaLabel="" onCta={() => {}} />
        ) : submissions.map((submission) => (
          <RequestCard
            key={submission.id}
            submission={submission}
            location={locations[submission.location_id]}
            organization={organizations[submission.organization_id]}
            activeLocationCount={activeCountByOrganization[submission.organization_id] || 0}
            busy={busy}
            onDecision={decide}
          />
        ))}
      </div>
    </AdminCard>
  );
}
