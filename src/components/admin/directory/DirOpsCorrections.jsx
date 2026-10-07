import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Flag, Loader2, Play, RefreshCw, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { correctionStatusLabel, correctionStatusTone } from "@/lib/adminLabels";
import { deadlineInfo, fullDateTime } from "@/lib/adminFormat";
import AdminCard from "@/components/admin/ui/AdminCard";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import { useAdminConfirm } from "@/components/admin/ui/AdminConfirm";
import { useAdminCounts } from "@/components/admin/useAdminCounts";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Noi" },
  { value: "in_review", label: "În verificare" },
  { value: "needs_more_info", label: "Așteaptă completări" },
  { value: "resolved", label: "Rezolvate" },
  { value: "rejected", label: "Respinse" },
];

const REQUEST_LABELS = {
  incorrect_information: "Informații incorecte",
  location_closed: "Locație închisă",
  location_moved: "Locație mutată",
  duplicate_profile: "Profil duplicat",
  wrong_organization: "Organizație asociată greșit",
  personal_data_removal: "Eliminare date personale",
  other: "Altă problemă",
};

const RELATIONSHIP_LABELS = {
  customer: "Client / vizitator",
  owner: "Proprietar",
  organization_representative: "Reprezentant organizație",
  employee: "Angajat",
  professional: "Specialist asociat",
  other: "Altă relație",
};

const RESOLUTION_OPTIONS = [
  { value: "manual_update", label: "Date corectate manual" },
  { value: "hide_profile", label: "Ascunde profilul" },
  { value: "close_location", label: "Închide locația" },
  { value: "merge_duplicate", label: "Dublură consolidată" },
  { value: "reassign_organization", label: "Organizație corectată" },
  { value: "no_change", label: "Rezolvat fără modificare" },
];

// Cererea de eliminare a datelor personale are termen legal de raspuns (GDPR art. 12: o luna), la fel
// ca stergerea contului din Suport (30 de zile).
const PERSONAL_DATA_RESPONSE_DAYS = 30;
const OPEN_STATUSES = ["submitted", "in_review", "needs_more_info"];

function personalDataDeadline(item) {
  if (item?.request_type !== "personal_data_removal" || !OPEN_STATUSES.includes(item.status)) return null;
  return deadlineInfo(item.submitted_at || item.created_date, PERSONAL_DATA_RESPONSE_DAYS);
}

const ACTION_BUTTON = "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold";

export default function DirOpsCorrections() {
  const confirm = useAdminConfirm();
  const { refresh: refreshCounts } = useAdminCounts();
  const [status, setStatus] = useState("submitted");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [note, setNote] = useState("");
  const [resolutionAction, setResolutionAction] = useState("manual_update");

  const selectedRequest = useMemo(() => requests.find((item) => item.id === action?.requestId) || null, [requests, action]);

  const load = async () => {
    setLoading(true);
    setError("");
    const response = await base44.functions.invoke("adminDirectoryCorrectionReview", {
      action: "list",
      status,
      limit: 200,
    }).catch((requestError) => ({ data: { error: requestError.response?.data?.error || requestError.message } }));
    setLoading(false);
    if (response.data?.error) {
      setError(response.data.error);
      setRequests([]);
      return;
    }
    setRequests(response.data?.requests || []);
  };

  useEffect(() => {
    setAction(null);
    setMessage("");
    setError("");
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- se reincarca doar cand se schimba filtrul de stare
  }, [status]);

  const beginAction = (requestId, mode) => {
    setAction({ requestId, mode });
    setNote("");
    setResolutionAction("manual_update");
    setMessage("");
    setError("");
  };

  const execute = async () => {
    if (!action) return;
    const payload = {
      action: action.mode,
      request_id: action.requestId,
      note,
      ...(action.mode === "resolve" ? { resolution_action: resolutionAction } : {}),
    };
    if (["request_more_info", "reject", "resolve"].includes(action.mode) && !note.trim()) {
      setError("Nota administrativă este obligatorie.");
      return;
    }
    if (action.mode === "resolve" && ["hide_profile", "close_location"].includes(resolutionAction)) {
      const closing = resolutionAction === "close_location";
      const confirmed = await confirm({
        title: closing ? "Închizi locația?" : "Ascunzi profilul public?",
        description: closing
          ? "Locația nu mai primește cereri și iese din director."
          : "Profilul rămâne ascuns până la o nouă verificare.",
        confirmLabel: closing ? "Închide locația" : "Ascunde profilul",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setSaving(action.requestId);
    setError("");
    const response = await base44.functions.invoke("adminDirectoryCorrectionReview", payload).catch((requestError) => ({
      data: { error: requestError.response?.data?.error || requestError.message },
    }));
    setSaving("");
    if (response.data?.error) {
      setError(response.data.error);
      return;
    }

    setMessage(action.mode === "start_review"
      ? "Sesizarea a fost preluată."
      : action.mode === "request_more_info"
        ? "Solicitantul a primit cererea de completări."
        : action.mode === "reject"
          ? "Sesizarea a fost respinsă, iar solicitantul a fost notificat."
          : "Sesizarea a fost rezolvată, iar solicitantul a fost notificat.");
    setAction(null);
    setNote("");
    await load();
    refreshCounts();
  };

  const actionLabel = action?.mode === "request_more_info"
    ? "Trimite cererea de completări"
    : action?.mode === "reject"
      ? "Respinge sesizarea"
      : action?.mode === "resolve"
        ? "Confirmă rezolvarea"
        : "Preia sesizarea";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Stare sesizări"
          className="min-h-10 rounded-xl border border-border bg-card px-3 text-sm"
        >
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Reîncarcă
        </button>
      </div>

      {message && <div role="status" className="rounded-2xl border border-success-border bg-success-soft px-4 py-3 text-xs text-success">{message}</div>}
      {error && <div role="alert" className="rounded-2xl border border-danger-border bg-danger-soft px-4 py-3 text-xs text-danger">{error}</div>}

      {action && selectedRequest && (
        <section className="rounded-2xl border border-foreground/20 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Acțiune pentru {selectedRequest.public_reference}</div>
              <h3 className="mt-1 text-sm font-bold">{REQUEST_LABELS[selectedRequest.request_type] || selectedRequest.request_type}</h3>
            </div>
            <button type="button" onClick={() => setAction(null)} className="text-xs font-semibold underline underline-offset-4">Anulează</button>
          </div>
          {action.mode === "resolve" && (
            <label className="mt-4 block text-xs font-semibold text-muted-foreground">
              Rezoluție
              <select value={resolutionAction} onChange={(event) => setResolutionAction(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                {RESOLUTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {!["hide_profile", "close_location"].includes(resolutionAction) && <span className="mt-1 block font-normal">Aplică mai întâi modificările necesare în profil, apoi marchează cererea ca rezolvată.</span>}
            </label>
          )}
          {action.mode !== "start_review" && (
            <label className="mt-4 block text-xs font-semibold text-muted-foreground">
              Notă pentru solicitant
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={1200} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </label>
          )}
          <button type="button" disabled={saving === action.requestId} onClick={execute} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-50">
            {saving === action.requestId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {actionLabel}
          </button>
        </section>
      )}

      {loading ? (
        <AdminLoading label="Se încarcă sesizările…" />
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nu există sesizări în această stare.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => {
            const deadline = personalDataDeadline(item);
            return (
              <AdminCard key={item.id} className={`p-5 ${item.priority === "high" ? "border-warning-border" : ""}`}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold">{item.public_reference}</span>
                      <StatusBadge label={correctionStatusLabel(item.status)} tone={correctionStatusTone(item.status)} />
                      {item.priority === "high" && <StatusBadge label="Prioritate ridicată" tone="warning" icon={AlertTriangle} />}
                      {deadline && <StatusBadge label={`Date personale · ${deadline.label}`} tone={deadline.tone} />}
                    </div>
                    <h3 className="mt-3 text-base font-bold">{REQUEST_LABELS[item.request_type] || item.request_type}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{item.location?.name || "Locație indisponibilă"} · {[item.location?.city, item.location?.address].filter(Boolean).join(" · ")}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{item.explanation}</p>

                    {item.evidence_urls?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.evidence_urls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Sursa
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 grid gap-2 rounded-2xl bg-secondary/35 p-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                      <div><span className="font-semibold text-foreground">Solicitant:</span> {item.contact_name}</div>
                      <div className="break-all"><span className="font-semibold text-foreground">Email:</span> {item.contact_email}</div>
                      <div><span className="font-semibold text-foreground">Relație:</span> {RELATIONSHIP_LABELS[item.relationship] || item.relationship}</div>
                      <div><span className="font-semibold text-foreground">Trimisă:</span> {fullDateTime(item.submitted_at)}</div>
                    </div>

                    {item.admin_note && <div className="mt-3 rounded-xl border border-border px-3 py-2 text-xs leading-relaxed"><span className="font-semibold">Notă admin:</span> {item.admin_note}</div>}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-64 xl:justify-end">
                    {item.location?.id && <Link to={`/furnizor/${item.location.id}`} target="_blank" className={`${ACTION_BUTTON} border-border hover:bg-secondary`}><ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Profil</Link>}
                    {["submitted", "needs_more_info"].includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "start_review")} className={`${ACTION_BUTTON} border-info-border text-info hover:bg-info-soft`}><Play className="h-3.5 w-3.5" aria-hidden="true" /> Preia</button>}
                    {["submitted", "in_review"].includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "request_more_info")} className={`${ACTION_BUTTON} border-info-border text-info hover:bg-info-soft`}><Flag className="h-3.5 w-3.5" aria-hidden="true" /> Completări</button>}
                    {OPEN_STATUSES.includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "resolve")} className={`${ACTION_BUTTON} border-success-border text-success hover:bg-success-soft`}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Rezolvă</button>}
                    {OPEN_STATUSES.includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "reject")} className={`${ACTION_BUTTON} border-danger-border text-danger hover:bg-danger-soft`}><XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Respinge</button>}
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
