import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Inbox, Loader2, RefreshCw, SearchCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const ACTIVE_STATUSES = new Set(["queued", "in_review"]);

const STATUS_OPTIONS = [
  { value: "queued", label: "În așteptare" },
  { value: "in_review", label: "În verificare" },
  { value: "completed", label: "Finalizată" },
  { value: "closed", label: "Închisă" },
];

const OUTCOME_OPTIONS = [
  { value: "pending", label: "Rezultat în așteptare" },
  { value: "criteria_revision_recommended", label: "Revizuirea criteriilor este recomandată" },
  { value: "location_change_recommended", label: "Schimbarea localității este recomandată" },
  { value: "no_confirmed_option", label: "Nu a fost identificată o opțiune confirmată" },
  { value: "directory_option_identified", label: "A fost identificată o opțiune din director" },
  { value: "data_correction_needed", label: "Datele directorului necesită verificare" },
];

const REASON_LABELS = {
  no_local_providers: "Fără furnizori publicați pentru această nevoie în localitatea selectată",
  local_service_data_missing: "Date insuficiente despre serviciile furnizorilor locali",
  no_eligible_local_results: "Niciun profil local nu îndeplinește condițiile de eligibilitate",
  query_not_mapped: "Descrierea nu a fost legată de un serviciu din catalog",
  query_required: "Descrierea necesită clarificare",
  canonical_locality_required: "Localitatea nu a putut fi validată",
  no_local_results: "Fără rezultate locale potrivite",
  no_search_results: "Căutarea nu a returnat rezultate",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (_error) {
    return String(value);
  }
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || "În așteptare";
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <AdminCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-1 font-heading text-2xl font-extrabold">{value}</div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </AdminCard>
  );
}

export default function AdminPatientRequestRecoveryQueue() {
  const [cases, setCases] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [request, setRequest] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    status: "queued",
    outcome: "pending",
    patient_update: "",
    internal_note: "",
  });

  const load = useCallback(async ({ preserveSelection = true } = {}) => {
    setError("");
    try {
      const rows = await base44.entities.PatientRequestRecoveryCase.list("-created_date", 2000);
      const nextCases = rows || [];
      setCases(nextCases);
      setSelectedId((current) => {
        if (preserveSelection && current && nextCases.some((item) => item.id === current)) return current;
        return nextCases[0]?.id || "";
      });
    } catch (loadError) {
      setCases([]);
      setError(loadError?.message || "Cererile pentru verificare nu au putut fi încărcate.");
    }
  }, []);

  useEffect(() => { void load({ preserveSelection: false }); }, [load]);

  const counts = useMemo(() => {
    const rows = cases || [];
    return {
      queued: rows.filter((item) => item.status === "queued").length,
      review: rows.filter((item) => item.status === "in_review").length,
      completed: rows.filter((item) => ["completed", "closed"].includes(item.status)).length,
      total: rows.length,
    };
  }, [cases]);

  const visibleCases = useMemo(() => (cases || []).filter((item) => {
    if (statusFilter === "active") return ACTIVE_STATUSES.has(item.status || "queued");
    if (statusFilter === "history") return !ACTIVE_STATUSES.has(item.status || "queued");
    return true;
  }), [cases, statusFilter]);

  useEffect(() => {
    if (visibleCases.length === 0) {
      setSelectedId("");
      return;
    }
    if (!visibleCases.some((item) => item.id === selectedId)) setSelectedId(visibleCases[0].id);
  }, [selectedId, visibleCases]);

  const selectedCase = useMemo(
    () => visibleCases.find((item) => item.id === selectedId) || null,
    [selectedId, visibleCases],
  );

  useEffect(() => {
    if (!selectedCase) {
      setRequest(null);
      return;
    }
    setDraft({
      status: selectedCase.status || "queued",
      outcome: selectedCase.outcome || "pending",
      patient_update: selectedCase.patient_update || "",
      internal_note: selectedCase.internal_note || "",
    });
    setLoadingRequest(true);
    setError("");
    base44.entities.PatientRequest.get(selectedCase.request_id)
      .then((row) => setRequest(row || null))
      .catch((loadError) => {
        setRequest(null);
        setError(loadError?.message || "Cererea asociată nu a putut fi încărcată.");
      })
      .finally(() => setLoadingRequest(false));
  }, [selectedCase]);

  const save = async () => {
    if (!selectedCase || saving) return;
    const patientUpdate = draft.patient_update.trim();
    if (["completed", "closed"].includes(draft.status) && !patientUpdate) {
      setError("Adaugă mesajul care va fi afișat pacientului înainte de finalizare.");
      return;
    }
    if (draft.status === "completed" && draft.outcome === "pending") {
      setError("Selectează rezultatul verificării înainte de finalizare.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const now = new Date().toISOString();
      const admin = await base44.auth.me().catch(() => null);
      await base44.entities.PatientRequestRecoveryCase.update(selectedCase.id, {
        status: draft.status,
        outcome: draft.outcome,
        patient_update: patientUpdate,
        internal_note: draft.internal_note.trim(),
        reviewed_by_user_id: admin?.id || selectedCase.reviewed_by_user_id || "",
        ...(draft.status === "in_review" && !selectedCase.review_started_at ? { review_started_at: now } : {}),
        ...(["completed", "closed"].includes(draft.status) ? { completed_at: now } : {}),
      });
      await load();
      setMessage("Verificarea a fost actualizată. Pacientul vede doar statusul, rezultatul și mesajul public.");
    } catch (saveError) {
      setError(saveError?.message || "Verificarea nu a putut fi actualizată.");
    } finally {
      setSaving(false);
    }
  };

  if (!cases) return <p className="text-sm text-muted-foreground">Se încarcă cererile fără rezultate...</p>;

  return (
    <div className="space-y-4" data-component="AdminPatientRequestRecoveryQueue">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Inbox} label="În așteptare" value={counts.queued} />
        <SummaryCard icon={SearchCheck} label="În verificare" value={counts.review} />
        <SummaryCard icon={CheckCircle2} label="Finalizate / închise" value={counts.completed} />
        <SummaryCard icon={Clock3} label="Total" value={counts.total} />
      </div>

      <AdminCard className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["active", `Active (${counts.queued + counts.review})`],
              ["history", `Istoric (${counts.completed})`],
              ["all", `Toate (${counts.total})`],
            ].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setStatusFilter(key)} className={`min-h-10 rounded-xl px-3 text-xs font-semibold ${statusFilter === key ? "bg-foreground text-background" : "border border-border bg-background hover:bg-secondary"}`}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} disabled={saving} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizează
          </button>
        </div>
      </AdminCard>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}
      {message && <div aria-live="polite" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">{message}</div>}

      {visibleCases.length === 0 ? (
        <AdminCard className="p-5"><EmptyState icon={Inbox} title="Nu există cereri în acest filtru" subtitle="Cererile salvate după o căutare fără rezultate vor apărea aici numai după acordul pacientului." /></AdminCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
          <AdminCard className="p-3">
            <div className="space-y-2">
              {visibleCases.map((item) => (
                <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setMessage(""); setError(""); }} className={`w-full rounded-2xl border p-4 text-left ${selectedId === item.id ? "border-foreground bg-secondary" : "border-border bg-card hover:bg-secondary/50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{item.public_reference || "Fără referință"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.city || "Localitate nespecificată"}{item.county ? `, ${item.county}` : ""}</p>
                    </div>
                    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{statusLabel(item.status)}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{REASON_LABELS[item.reason] || "Căutare fără rezultate"}</p>
                  <p className="mt-2 text-[10px] text-muted-foreground">Adăugată: {formatDate(item.queued_at || item.created_date)}</p>
                </button>
              ))}
            </div>
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            {!selectedCase ? null : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Cerere fără rezultate</p>
                    <h2 className="mt-1 font-heading text-xl font-extrabold">{selectedCase.public_reference}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedCase.city || "—"}{selectedCase.county ? `, ${selectedCase.county}` : ""}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">{statusLabel(selectedCase.status)}</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-secondary/50 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Profiluri locale</p><p className="mt-1 text-lg font-extrabold">{Number(selectedCase.local_provider_count) || 0}</p></div>
                  <div className="rounded-xl bg-secondary/50 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Cu date serviciu</p><p className="mt-1 text-lg font-extrabold">{Number(selectedCase.configured_matching_provider_count) || 0}</p></div>
                  <div className="rounded-xl bg-secondary/50 p-3"><p className="text-[10px] font-bold uppercase text-muted-foreground">Eligibile</p><p className="mt-1 text-lg font-extrabold">{Number(selectedCase.eligible_provider_count) || 0}</p></div>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-bold text-foreground">Motivul intrării în coadă</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{REASON_LABELS[selectedCase.reason] || "Căutarea nu a returnat rezultate."}</p>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-bold text-foreground">Cererea pacientului</p>
                  {loadingRequest ? (
                    <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Se încarcă...</p>
                  ) : (
                    <>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{request?.detailed_message || request?.original_message || "Fără mesaj disponibil."}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(request?.service_keys || selectedCase.service_keys || []).map((key) => <span key={key} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold">{key}</span>)}
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold">Status
                    <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal">
                      {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">Rezultat
                    <select value={draft.outcome} onChange={(event) => setDraft((current) => ({ ...current, outcome: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal">
                      {OUTCOME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>

                <label className="mt-4 block text-xs font-semibold">Mesaj vizibil pacientului
                  <textarea value={draft.patient_update} onChange={(event) => setDraft((current) => ({ ...current, patient_update: event.target.value }))} maxLength={500} rows={4} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-normal" placeholder="Explică rezultatul verificării fără date interne sau promisiuni de disponibilitate." />
                </label>

                <label className="mt-4 block text-xs font-semibold">Notă internă
                  <textarea value={draft.internal_note} onChange={(event) => setDraft((current) => ({ ...current, internal_note: event.target.value }))} maxLength={1000} rows={3} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm font-normal" placeholder="Informații interne pentru audit. Nu sunt afișate pacientului." />
                </label>

                <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {saving ? "Se salvează..." : "Salvează verificarea"}
                </button>
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
