import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { SUBMISSION_STATUS_LABELS } from "@/lib/workspaceStatusLabels";

const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none";
const QUICK_FIELDS = [
  ["public_description", "Descriere publica", "textarea"],
  ["public_phone", "Telefon public", "text"],
  ["public_email", "Email public", "text"],
  ["website_url", "Website", "text"],
  ["facebook_url", "Facebook", "text"],
  ["instagram_url", "Instagram", "text"],
  ["linkedin_url", "LinkedIn", "text"],
];

export default function ProviderProfilePublic({ locationId, overview, onRefresh }) {
  const pv = overview.public_preview || {};
  const [quick, setQuick] = useState({
    public_description: pv.description || "",
    public_phone: pv.phone || "",
    public_email: pv.email || "",
    website_url: pv.website || "",
    facebook_url: pv.facebook || "",
    instagram_url: pv.instagram || "",
    linkedin_url: pv.linkedin || "",
  });
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickMsg, setQuickMsg] = useState("");

  const [reviewDraft, setReviewDraft] = useState(null);
  const [reviewValues, setReviewValues] = useState({ public_display_name: overview.location.public_display_name || "", address: "" });
  const [savingReview, setSavingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  const loadOwnDraft = async () => {
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "list_mine", location_id: locationId }).catch(() => ({ data: { submissions: [] } }));
    const own = (res.data?.submissions || []).find((s) => s.section === "location_details" && ["draft", "needs_more_info", "pending_review"].includes(s.status));
    setReviewDraft(own || null);
    if (own) setReviewValues(JSON.parse(own.payload_json || "{}"));
  };

  useEffect(() => { loadOwnDraft(); }, [locationId]);

  const saveQuick = async () => {
    setSavingQuick(true); setQuickMsg("");
    const res = await base44.functions.invoke("saveProviderRoutineProfile", { location_id: locationId, ...quick }).catch((e) => ({ data: { error: e.message } }));
    setSavingQuick(false);
    if (res.data?.error) { setQuickMsg(res.data.error); return; }
    setQuickMsg("Salvat.");
    onRefresh();
  };

  const saveReview = async () => {
    setSavingReview(true); setReviewMsg("");
    const action = reviewDraft && reviewDraft.status !== "pending_review" ? "update_draft" : "create_draft";
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", {
      action, submission_id: reviewDraft?.id, location_id: locationId, section: "location_details", payload: reviewValues,
    }).catch((e) => ({ data: { error: e.message } }));
    setSavingReview(false);
    if (res.data?.error) { setReviewMsg(res.data.error); return; }
    setReviewMsg("Salvat.");
    loadOwnDraft();
  };

  const submitReview = async () => {
    if (!reviewDraft) return;
    setSavingReview(true); setReviewMsg("");
    const res = await base44.functions.invoke("submitProviderWorkspaceChange", { action: "submit", submission_id: reviewDraft.id, location_id: locationId, section: "location_details" }).catch((e) => ({ data: { error: e.message } }));
    setSavingReview(false);
    if (res.data?.error) { setReviewMsg(res.data.error); return; }
    setReviewMsg("Trimis spre review.");
    loadOwnDraft();
  };

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-extrabold tracking-tight">Profil public</h1>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <div className="font-semibold text-sm">Actualizare rapida</div>
          <p className="text-xs text-muted-foreground mt-1">Modificarile administrative normale se actualizeaza imediat dupa salvare.</p>
        </div>
        {QUICK_FIELDS.map(([key, label, type]) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground">{label}</label>
            {type === "textarea" ? (
              <textarea className={inputCls} rows={3} value={quick[key]} onChange={(e) => setQuick({ ...quick, [key]: e.target.value })} />
            ) : (
              <input className={inputCls} value={quick[key]} onChange={(e) => setQuick({ ...quick, [key]: e.target.value })} />
            )}
          </div>
        ))}
        <button disabled={savingQuick} onClick={saveQuick} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
          Salveaza
        </button>
        {quickMsg && <p className="text-xs text-muted-foreground">{quickMsg}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div>
          <div className="font-semibold text-sm">Schimbari care necesita review</div>
          <p className="text-xs text-muted-foreground mt-1">Aceste modificari pot afecta identificarea locatiei si sunt verificate inainte de publicare.</p>
          {reviewDraft && <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary">{SUBMISSION_STATUS_LABELS[reviewDraft.status] || reviewDraft.status}</span>}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Nume public afisat</label>
          <input className={inputCls} value={reviewValues.public_display_name || ""} onChange={(e) => setReviewValues({ ...reviewValues, public_display_name: e.target.value })} disabled={reviewDraft?.status === "pending_review"} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Adresa</label>
          <input className={inputCls} value={reviewValues.address || ""} onChange={(e) => setReviewValues({ ...reviewValues, address: e.target.value })} disabled={reviewDraft?.status === "pending_review"} />
        </div>
        <div className="flex gap-2">
          <button disabled={savingReview || reviewDraft?.status === "pending_review"} onClick={saveReview} className="px-5 py-2.5 rounded-full text-sm font-semibold border border-border disabled:opacity-50">
            Salveaza draft
          </button>
          {reviewDraft && reviewDraft.status !== "pending_review" && (
            <button disabled={savingReview} onClick={submitReview} className="px-5 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#171717" }}>
              Trimite spre review
            </button>
          )}
        </div>
        {reviewMsg && <p className="text-xs text-muted-foreground">{reviewMsg}</p>}
      </div>
    </div>
  );
}