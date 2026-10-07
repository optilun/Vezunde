import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Inbox, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { fullDateTime, oldestFirst, waitingInfo } from "@/lib/adminFormat";
import { getServiceLabel } from "@/lib/serviceAutocomplete";

const ACTIVE_STATUSES = new Set(["queued", "in_review"]);

const STATUS_OPTIONS = [
  { value: "queued", label: "În așteptare" },
  { value: "in_review", label: "În verificare" },
  { value: "completed", label: "Finalizată" },
  { value: "closed", label: "Închisă" },
];
const STATUS_TONES = { queued: "warning", in_review: "info", completed: "success", closed: "neutral" };

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

const FILTER_LABEL = { active: "Active", history: "Istoric", all: "Toate" };

function statusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || "În așteptare";
}

function queuedAt(item) {
  return item.queued_at || item.created_date;
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-secondary/50 p-3">
      <p className="text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
    </div>
  );
}

export default function AdminPatientRequestRecoveryQueue() {
  const { refresh: refreshCounts } = useAdminCounts();
  const [cases, setCases] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [request, setRequest] = useState(null);
  const [statusFilter, setStatusFilter] = useState("active");
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const detailRef = useRef(null);
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
        return "";
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

  // Cele active, cele mai vechi primele (sunt cele care așteaptă cel mai mult); istoricul, cele mai noi primele.
  const visibleCases = useMemo(() => {
    const rows = (cases || []).filter((item) => {
      if (statusFilter === "active") return ACTIVE_STATUSES.has(item.status || "queued");
      if (statusFilter === "history") return !ACTIVE_STATUSES.has(item.status || "queued");
      return true;
    });
    return statusFilter === "active" ? oldestFirst(rows, queuedAt) : rows;
  }, [cases, statusFilter]);

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

  const select = (id) => {
    setSelectedId(id);
    setMessage("");
    setError("");
    // Sub ecranul larg, detaliul e sub listă: te ducem la el, ca să nu cauți formularul.
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1280px)").matches) {
      window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    }
  };

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
      refreshCounts();
      setMessage("Verificarea a fost actualizată. Pacientul vede doar statusul, rezultatul și mesajul public.");
    } catch (saveError) {
      setError(saveError?.message || "Verificarea nu a putut fi actualizată.");
    } finally {
      setSaving(false);
    }
  };

  if (!cases) return <AdminLoading label="Se încarcă cererile fără rezultate…" />;

  const chips = [
    { key: "active", label: FILTER_LABEL.active, count: counts.queued + counts.review },
    { key: "history", label: FILTER_LABEL.history, count: counts.completed },
    { key: "all", label: FILTER_LABEL.all, count: counts.total },
  ];
  const serviceKeys = request?.service_keys || selectedCase?.service_keys || [];

  return (
    <div className="space-y-4" data-component="AdminPatientRequestRecoveryQueue">
      <AdminCard className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <AdminChips options={chips} value={statusFilter} onChange={setStatusFilter} label="Filtrează cererile" />
            {statusFilter === "active" && (counts.queued > 0 || counts.review > 0) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {counts.queued} în așteptare · {counts.review} în verificare
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Actualizează
          </button>
        </div>
      </AdminCard>

      {error && <AdminNotice tone="danger">{error}</AdminNotice>}
      {message && <AdminNotice tone="success" onDismiss={() => setMessage("")}>{message}</AdminNotice>}

      {visibleCases.length === 0 ? (
        <AdminCard className="p-5">
          <EmptyState
            icon={Inbox}
            title="Nu există cereri în acest filtru."
            subtitle="Cererile salvate după o căutare fără rezultate apar aici doar cu acordul pacientului."
          />
        </AdminCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]">
          <AdminCard className="p-3">
            <ul className="space-y-2" aria-label="Cereri fără rezultate">
              {visibleCases.map((item) => {
                const active = ACTIVE_STATUSES.has(item.status || "queued");
                const waiting = active ? waitingInfo(queuedAt(item)) : null;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => select(item.id)}
                      aria-current={selectedId === item.id ? "true" : undefined}
                      className={`w-full rounded-2xl border p-4 text-left transition-colors ${selectedId === item.id ? "border-foreground bg-secondary" : "border-border bg-card hover:bg-secondary/50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-foreground">{item.public_reference || "Fără referință"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.city || "Localitate nespecificată"}{item.county ? `, ${item.county}` : ""}</p>
                        </div>
                        <StatusBadge label={statusLabel(item.status)} tone={STATUS_TONES[item.status] || "warning"} />
                      </div>
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{REASON_LABELS[item.reason] || "Căutare fără rezultate"}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground" title={fullDateTime(queuedAt(item))}>
                        {waiting ? <>Adăugată <span className={waiting.tone === "danger" ? "font-semibold text-danger" : waiting.tone === "warning" ? "font-semibold text-warning" : ""}>{waiting.label}</span></> : `Adăugată ${fullDateTime(queuedAt(item))}`}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            <div ref={detailRef} className="scroll-mt-20" />
            {!selectedCase ? null : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Cerere fără rezultate</p>
                    <h2 className="mt-1 font-heading text-xl font-extrabold">{selectedCase.public_reference}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedCase.city || "—"}{selectedCase.county ? `, ${selectedCase.county}` : ""}</p>
                  </div>
                  <StatusBadge label={statusLabel(selectedCase.status)} tone={STATUS_TONES[selectedCase.status] || "warning"} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Stat label="Profiluri locale" value={Number(selectedCase.local_provider_count) || 0} />
                  <Stat label="Cu date serviciu" value={Number(selectedCase.configured_matching_provider_count) || 0} />
                  <Stat label="Eligibile" value={Number(selectedCase.eligible_provider_count) || 0} />
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-bold text-foreground">De ce a intrat în coadă</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{REASON_LABELS[selectedCase.reason] || "Căutarea nu a returnat rezultate."}</p>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-background p-4">
                  <p className="text-xs font-bold text-foreground">Cererea pacientului</p>
                  {loadingRequest ? (
                    <p className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Se încarcă…</p>
                  ) : (
                    <>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{request?.detailed_message || request?.original_message || "Fără mesaj disponibil."}</p>
                      {serviceKeys.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {serviceKeys.map((key) => <StatusBadge key={key} label={getServiceLabel(key)} />)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold">Status
                    <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal">
                      {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">Rezultat
                    <select value={draft.outcome} onChange={(event) => setDraft((current) => ({ ...current, outcome: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal">
                      {OUTCOME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>

                <label className="mt-4 block text-xs font-semibold">Mesaj vizibil pacientului
                  <textarea value={draft.patient_update} onChange={(event) => setDraft((current) => ({ ...current, patient_update: event.target.value }))} maxLength={500} rows={4} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-normal sm:text-sm" placeholder="Explică rezultatul verificării fără date interne sau promisiuni de disponibilitate." />
                  <span className="mt-1 block text-right text-[11px] font-normal text-muted-foreground">{draft.patient_update.length}/500</span>
                </label>

                <label className="mt-2 block text-xs font-semibold">Notă internă
                  <textarea value={draft.internal_note} onChange={(event) => setDraft((current) => ({ ...current, internal_note: event.target.value }))} maxLength={1000} rows={3} className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-3 text-base font-normal sm:text-sm" placeholder="Informații interne pentru istoric. Nu sunt afișate pacientului." />
                </label>

                <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {saving ? "Se salvează…" : "Salvează verificarea"}
                </button>
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
