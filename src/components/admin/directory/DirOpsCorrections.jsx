import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Flag, Loader2, Play, RefreshCw, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const STATUS_OPTIONS = [
  { value: "submitted", label: "Noi" },
  { value: "in_review", label: "In verificare" },
  { value: "needs_more_info", label: "Asteapta completari" },
  { value: "resolved", label: "Rezolvate" },
  { value: "rejected", label: "Respinse" },
];

const REQUEST_LABELS = {
  incorrect_information: "Informatii incorecte",
  location_closed: "Locatie inchisa",
  location_moved: "Locatie mutata",
  duplicate_profile: "Profil duplicat",
  wrong_organization: "Organizatie asociata gresit",
  personal_data_removal: "Eliminare date personale",
  other: "Alta problema",
};

const RELATIONSHIP_LABELS = {
  customer: "Client / vizitator",
  owner: "Proprietar",
  organization_representative: "Reprezentant organizatie",
  employee: "Angajat",
  professional: "Specialist asociat",
  other: "Alta relatie",
};

const RESOLUTION_OPTIONS = [
  { value: "manual_update", label: "Date corectate manual" },
  { value: "hide_profile", label: "Ascunde profilul" },
  { value: "close_location", label: "Inchide locatia" },
  { value: "merge_duplicate", label: "Dublura consolidata" },
  { value: "reassign_organization", label: "Organizatie corectata" },
  { value: "no_change", label: "Rezolvat fara modificare" },
];

function formatDate(value) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("ro-RO"); } catch { return "—"; }
}

function statusClass(status) {
  if (status === "submitted") return "bg-blue-50 text-blue-800";
  if (status === "in_review") return "bg-amber-50 text-amber-800";
  if (status === "needs_more_info") return "bg-violet-50 text-violet-800";
  if (status === "resolved") return "bg-green-50 text-green-800";
  if (status === "rejected") return "bg-red-50 text-red-800";
  return "bg-secondary text-muted-foreground";
}

export default function DirOpsCorrections() {
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
      setError("Nota administrativa este obligatorie.");
      return;
    }
    if (action.mode === "resolve" && ["hide_profile", "close_location"].includes(resolutionAction)) {
      const confirmed = window.confirm(resolutionAction === "close_location"
        ? "Inchizi locatia si opresti primirea cererilor?"
        : "Ascunzi profilul public pana la o noua verificare?");
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
      ? "Sesizarea a fost preluata."
      : action.mode === "request_more_info"
        ? "Solicitantul a primit cererea de completari."
        : action.mode === "reject"
          ? "Sesizarea a fost respinsa si notificata."
          : "Sesizarea a fost rezolvata si notificata.");
    setAction(null);
    setNote("");
    await load();
  };

  const actionLabel = action?.mode === "request_more_info"
    ? "Trimite cererea de completari"
    : action?.mode === "reject"
      ? "Respinge sesizarea"
      : action?.mode === "resolve"
        ? "Confirma rezolvarea"
        : "Preia sesizarea";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-bold">Corectii si eliminari</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">Sesizari publice legate de profiluri. Ascunderea si inchiderea aplica automat starile lifecycle; celelalte rezolutii se marcheaza dupa corectarea administrativa.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-10 rounded-xl border border-border bg-card px-3 text-sm">
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Reincarca
          </button>
        </div>
      </div>

      {message && <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">{message}</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">{error}</div>}

      {action && selectedRequest && (
        <section className="rounded-3xl border border-foreground/20 bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Actiune pentru {selectedRequest.public_reference}</div>
              <h3 className="mt-1 text-sm font-bold">{REQUEST_LABELS[selectedRequest.request_type] || selectedRequest.request_type}</h3>
            </div>
            <button type="button" onClick={() => setAction(null)} className="text-xs font-semibold underline underline-offset-4">Anuleaza</button>
          </div>
          {action.mode === "resolve" && (
            <label className="mt-4 block text-xs font-semibold text-muted-foreground">
              Rezolutie
              <select value={resolutionAction} onChange={(event) => setResolutionAction(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm">
                {RESOLUTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {!["hide_profile", "close_location"].includes(resolutionAction) && <span className="mt-1 block font-normal">Aplica mai intai modificarile necesare in profil, apoi marcheaza cererea ca rezolvata.</span>}
            </label>
          )}
          {action.mode !== "start_review" && (
            <label className="mt-4 block text-xs font-semibold text-muted-foreground">
              Nota pentru solicitant
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={1200} className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
            </label>
          )}
          <button type="button" disabled={saving === action.requestId} onClick={execute} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-50">
            {saving === action.requestId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {actionLabel}
          </button>
        </section>
      )}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca sesizarile...</div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nu exista sesizari in aceasta stare.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => (
            <article key={item.id} className={`rounded-3xl border bg-card p-5 shadow-sm ${item.priority === "high" ? "border-amber-300" : "border-border"}`}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold">{item.public_reference}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                    {item.priority === "high" && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900"><AlertTriangle className="h-3.5 w-3.5" /> Prioritate ridicata</span>}
                  </div>
                  <h3 className="mt-3 text-base font-bold">{REQUEST_LABELS[item.request_type] || item.request_type}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.location?.name || "Locatie indisponibila"} · {[item.location?.city, item.location?.address].filter(Boolean).join(" · ")}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{item.explanation}</p>

                  {item.evidence_urls?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.evidence_urls.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                          <ExternalLink className="h-3.5 w-3.5" /> Sursa
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 grid gap-2 rounded-2xl bg-secondary/35 p-3 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                    <div><span className="font-semibold text-foreground">Solicitant:</span> {item.contact_name}</div>
                    <div className="break-all"><span className="font-semibold text-foreground">Email:</span> {item.contact_email}</div>
                    <div><span className="font-semibold text-foreground">Relatie:</span> {RELATIONSHIP_LABELS[item.relationship] || item.relationship}</div>
                    <div><span className="font-semibold text-foreground">Trimisa:</span> {formatDate(item.submitted_at)}</div>
                  </div>

                  {item.admin_note && <div className="mt-3 rounded-xl border border-border px-3 py-2 text-xs leading-relaxed"><span className="font-semibold">Nota admin:</span> {item.admin_note}</div>}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-64 xl:justify-end">
                  {item.location?.id && <Link to={`/furnizor/${item.location.id}`} target="_blank" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold hover:bg-secondary"><ExternalLink className="h-3.5 w-3.5" /> Profil</Link>}
                  {["submitted", "needs_more_info"].includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "start_review")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Play className="h-3.5 w-3.5" /> Preia</button>}
                  {["submitted", "in_review"].includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "request_more_info")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-violet-200 px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50"><Flag className="h-3.5 w-3.5" /> Completari</button>}
                  {["submitted", "in_review", "needs_more_info"].includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "resolve")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-green-200 px-3 text-xs font-semibold text-green-700 hover:bg-green-50"><CheckCircle2 className="h-3.5 w-3.5" /> Rezolva</button>}
                  {["submitted", "in_review", "needs_more_info"].includes(item.status) && <button type="button" onClick={() => beginAction(item.id, "reject")} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" /> Respinge</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
