import React, { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, MessageSquareMore, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const SECTION_LABELS = {
  organization_profile: "Profil organizatie",
  public_profile: "Profil locatie legacy",
  location_details: "Detalii locatie",
  services: "Servicii locatie",
  team: "Specialisti publici",
};

function parsePayload(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch (_e) { return { _invalid_json: true }; }
}

function formatDate(value) {
  if (!value) return "-";
  try { return new Date(value).toLocaleString("ro-RO"); } catch (_e) { return value; }
}

export default function AdminWorkspaceSubmissions() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("pending_review");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("adminWorkspaceReview", { action: "list", status });
      setItems(res.data?.submissions || res.data?.items || []);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Nu am putut incarca review-urile workspace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  const decide = async (submission, action) => {
    let note = "";
    if (action === "reject" || action === "request_more_info") {
      note = window.prompt(action === "reject" ? "Nota de respingere" : "Ce informatii lipsesc?") || "";
      if (!note.trim()) return;
    }
    setBusyId(submission.id);
    setError("");
    try {
      await base44.functions.invoke("adminWorkspaceReview", {
        action,
        submission_id: submission.id,
        note,
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Decizia nu a putut fi aplicata.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold">Review modificari provider workspace</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aproba doar modificari care au trecut prin ProviderWorkspaceSubmission.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-input bg-card px-3 text-sm">
          <option value="pending_review">In review</option>
          <option value="needs_more_info">Needs more info</option>
          <option value="approved">Aprobate</option>
          <option value="rejected">Respinse</option>
        </select>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {loading && <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">Se incarca...</div>}
      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <ClipboardCheck className="w-7 h-7 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">Nu exista modificari in aceasta coada.</p>
          <p className="mt-1 text-sm text-muted-foreground">Cand un furnizor trimite profil, detalii locatie, servicii sau specialisti, apar aici.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((submission) => {
          const payload = parsePayload(submission.payload_json);
          const pending = submission.status === "pending_review";
          return (
            <article key={submission.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SECTION_LABELS[submission.section] || submission.section}</p>
                  <h3 className="mt-1 font-semibold">Submission {submission.id}</h3>
                  <div className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <p>Status: {submission.status}</p>
                    <p>Access: {submission.access_origin || "provider_workspace"}</p>
                    <p>Locatie: {submission.location_id || "-"}</p>
                    <p>Organizatie: {submission.organization_id || "-"}</p>
                    <p>Trimis de: {submission.submitted_by_user_id || "-"}</p>
                    <p>Creat: {formatDate(submission.created_date)}</p>
                  </div>
                </div>
                {pending && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => decide(submission, "approve")} disabled={busyId === submission.id}>
                      <CheckCircle2 className="w-4 h-4" /> Aproba
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide(submission, "request_more_info")} disabled={busyId === submission.id}>
                      <MessageSquareMore className="w-4 h-4" /> Cere completari
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => decide(submission, "reject")} disabled={busyId === submission.id}>
                      <XCircle className="w-4 h-4" /> Respinge
                    </Button>
                  </div>
                )}
              </div>
              <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-secondary p-3 text-xs whitespace-pre-wrap break-words">{JSON.stringify(payload, null, 2)}</pre>
            </article>
          );
        })}
      </div>
    </div>
  );
}
