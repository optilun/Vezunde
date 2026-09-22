import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import OutreachRecipientPicker from "./OutreachRecipientPicker";
import OutreachEmailPreview from "./OutreachEmailPreview";
import OutreachCampaignReport from "./OutreachCampaignReport";
import {
  CATEGORY_LABELS,
  categoryBadgeClass,
  normalizeCategory,
  callOutreach,
} from "./outreachLabels";

const STATUS_LABELS = {
  draft: "Ciorna",
  ready: "Pregatita",
  sending: "Se trimite",
  sent: "Trimisa",
  paused: "Pausata",
  failed: "Esuata",
  cancelled: "Anulata",
};

// Aceleasi reguli ca in base44/shared/outreachSendSafety.js (effectiveDailyLimit): limita se
// dubleaza in fiecare zi de trimitere, pana la 2000. Doar pentru estimarea afisata adminului.
const DAILY_LIMIT_MIN = 10;
const DAILY_LIMIT_MAX = 2000;
const DAILY_LIMIT_DEFAULT = 50;

function clampDailyLimit(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DAILY_LIMIT_DEFAULT;
  return Math.min(DAILY_LIMIT_MAX, Math.max(DAILY_LIMIT_MIN, n));
}

// startDay = cate zile de trimitere au trecut deja; sentToday = cate au plecat azi. O zi de azi
// deja plina nu apare in estimare (se vede separat mesajul "continua maine").
function sendSchedule(total, limit, ramp, startDay = 0, sentToday = 0) {
  const days = [];
  let left = Math.max(0, Number(total) || 0);
  const base = clampDailyLimit(limit);
  let day = Math.max(0, Number(startDay) || 0);
  let first = true;
  while (left > 0 && days.length < 60) {
    const cap = ramp ? Math.min(DAILY_LIMIT_MAX, base * 2 ** Math.min(day, 10)) : base;
    const available = first ? Math.max(0, cap - (Number(sentToday) || 0)) : cap;
    const today = Math.min(available, left);
    if (today > 0) days.push(today);
    left -= today;
    day += 1;
    first = false;
  }
  return days;
}

function SendSchedulePreview({ total, limit, ramp, startDay = 0, sentToday = 0 }) {
  if (!total) return null;
  const days = sendSchedule(total, limit, ramp, startDay, sentToday);
  const shown = days.slice(0, 8).join(" · ");
  return (
    <p className="text-[11px] text-muted-foreground">
      Estimare pentru {total} destinatari: {shown}{days.length > 8 ? " · ..." : ""} — {days.length === 1 ? "o zi" : `${days.length} zile`} de trimitere.
    </p>
  );
}

const HEALTH_PAUSE_REASONS = ["bounce_rate", "complaints"];

const STEPS = [
  { key: 1, label: "Continut" },
  { key: 2, label: "Destinatari" },
  { key: 3, label: "Previzualizare si test" },
  { key: 4, label: "Trimitere" },
];

const MERGE_FIELDS_HINT = "[FIRMA] numele firmei · [ORAS] · [JUDET] · [LOCATII] „79 de locatii” · [ORASE] „35 de orase” · [NUME] persoana de contact";

// Campurile ciornei care se salveaza pe campanie. Tot ce e aici trece prin update_campaign.
function draftFromCampaign(campaign) {
  return {
    category: normalizeCategory(campaign.category),
    template_id: campaign.template_id || "",
    subject: campaign.subject || "",
    body_html: campaign.body_html || "",
    cta_label: campaign.cta_label || "",
    cta_url: campaign.cta_url || "",
    show_listing_preview: campaign.show_listing_preview !== false,
    from_name: campaign.from_name || "VIASEE",
    from_email: campaign.from_email || "",
    reply_to_email: campaign.reply_to_email || "",
    audience_sources: Array.isArray(campaign.audience_sources) && campaign.audience_sources.length ? campaign.audience_sources : ["directory"],
    audience_mode: campaign.audience_mode === "manual" ? "manual" : "filters",
    included_contact_ids: campaign.included_contact_ids || [],
    excluded_contact_ids: campaign.excluded_contact_ids || [],
    target_counties: campaign.target_counties || [],
    target_provider_types: campaign.target_provider_types || [],
    target_profile_control_status: campaign.target_profile_control_status || [],
    target_tags: campaign.target_tags || [],
    target_email_scope: campaign.target_email_scope || [],
    daily_send_limit: clampDailyLimit(campaign.daily_send_limit),
    daily_send_ramp: campaign.daily_send_ramp !== false,
  };
}

export default function OutreachCampaignDetail({ campaignId, onBack }) {
  const [campaign, setCampaign] = useState(null);
  const [sendStats, setSendStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);

  const [editDraft, setEditDraft] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [templates, setTemplates] = useState([]);

  const [approvalPreview, setApprovalPreview] = useState(null);
  const [confirmationText, setConfirmationText] = useState("");

  const [limitDraft, setLimitDraft] = useState({ daily_send_limit: DAILY_LIMIT_DEFAULT, daily_send_ramp: true });

  const load = async () => {
    setLoading(true);
    setError("");
    const data = await callOutreach("outreachCampaignOps", "get_campaign", { id: campaignId, log_limit: 1 });
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setCampaign(data.campaign);
    setSendStats(data.send_stats || null);
    const draft = draftFromCampaign(data.campaign);
    setEditDraft(draft);
    setSavedSnapshot(JSON.stringify(draft));
    setLimitDraft({
      daily_send_limit: clampDailyLimit(data.campaign.daily_send_limit),
      daily_send_ramp: data.campaign.daily_send_ramp !== false,
    });
  };

  useEffect(() => { load(); }, [campaignId]);

  useEffect(() => {
    let active = true;
    callOutreach("outreachCampaignOps", "list_templates").then((data) => {
      if (active && Array.isArray(data.templates)) setTemplates(data.templates);
    });
    return () => { active = false; };
  }, []);

  const dirty = editDraft ? JSON.stringify(editDraft) !== savedSnapshot : false;
  const patchDraft = (patch) => setEditDraft((d) => ({ ...d, ...patch }));

  const categoryTemplates = useMemo(
    () => templates.filter((template) => normalizeCategory(template.category) === (editDraft?.category || "marketing")),
    [templates, editDraft?.category],
  );

  // Sablonul doar PRECOMPLETEAZA ciorna: textul ramane editabil aici, iar campania
  // pastreaza propria copie. Modificarea ulterioara a sablonului nu schimba campaniile.
  const applyTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setEditDraft((d) => ({
      ...d,
      template_id: template.id,
      subject: template.subject || d.subject,
      body_html: template.body || d.body_html,
      cta_label: template.cta_label ?? d.cta_label,
      cta_url: template.cta_url ?? d.cta_url,
      show_listing_preview: template.show_listing_preview !== false && normalizeCategory(template.category) === "marketing",
    }));
  };

  const saveEdits = async () => {
    if (!editDraft) return false;
    if (!dirty) return true;
    setBusy(true);
    setError("");
    const data = await callOutreach("outreachCampaignOps", "update_campaign", { id: campaignId, ...editDraft });
    setBusy(false);
    if (data.error) { setError(data.error); return false; }
    setCampaign(data.campaign || campaign);
    setSavedSnapshot(JSON.stringify(editDraft));
    return true;
  };

  const goToStep = async (next) => {
    if (next === step) return;
    const ok = await saveEdits();
    if (ok) { setStep(next); setApprovalPreview(null); setConfirmationText(""); }
  };

  const openApproval = async () => {
    const ok = await saveEdits();
    if (!ok) return;
    setError("");
    const data = await callOutreach("outreachCampaignOps", "approve_campaign", { id: campaignId, confirmation_text: "" });
    if (data.expected_confirmation) {
      setApprovalPreview({ expected: data.expected_confirmation, recipientCount: data.recipient_count });
    } else if (data.error) {
      setError(data.error);
    }
  };

  const confirmApproval = async () => {
    setBusy(true);
    setError("");
    // Ritmul afisat in estimare e cel care se aplica: il salvam pe campanie odata cu aprobarea.
    const saved = await callOutreach("outreachCampaignOps", "update_campaign", {
      id: campaignId,
      daily_send_limit: editDraft.daily_send_limit,
      daily_send_ramp: editDraft.daily_send_ramp,
    });
    if (saved.error) { setBusy(false); setError(saved.error); return; }
    const data = await callOutreach("outreachCampaignOps", "approve_campaign", { id: campaignId, confirmation_text: confirmationText });
    setBusy(false);
    if (data.error) { setError(data.error); return; }
    setApprovalPreview(null);
    setConfirmationText("");
    await load();
  };

  const setStatus = async (action) => {
    setBusy(true);
    setError("");
    const data = await callOutreach("outreachCampaignOps", action, { id: campaignId });
    setBusy(false);
    if (data.error) { setError(data.error); return; }
    await load();
  };

  const saveDailyLimit = async () => {
    setBusy(true);
    setError("");
    const data = await callOutreach("outreachCampaignOps", "set_daily_send_limit", { id: campaignId, ...limitDraft });
    setBusy(false);
    if (data.error) { setError(data.error); return; }
    await load();
  };

  const resumeCampaign = () => {
    if (HEALTH_PAUSE_REASONS.includes(campaign.pause_reason)) {
      const ok = window.confirm("Campania a fost oprita automat. Daca o reiei, protectia se calculeaza din nou doar pentru emailurile trimise de acum inainte. Continui?");
      if (!ok) return;
    }
    setStatus("resume_campaign");
  };

  if (loading || !campaign || !editDraft) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {error ? <span className="text-red-700">{error}</span> : <><Loader2 className="h-4 w-4 animate-spin" /> Se incarca campania...</>}
      </div>
    );
  }

  const isDraft = campaign.status === "draft";
  const canPause = ["ready", "sending"].includes(campaign.status);
  const canResume = campaign.status === "paused";
  const canCancel = ["draft", "ready", "sending", "paused"].includes(campaign.status);
  const isAutoPaused = campaign.status === "paused" && HEALTH_PAUSE_REASONS.includes(campaign.pause_reason);
  const waitingUntil = campaign.next_send_after && new Date(campaign.next_send_after).getTime() > Date.now()
    ? new Date(campaign.next_send_after)
    : null;
  const remainingRecipients = Math.max(0, (campaign.recipient_count || 0) - (campaign.current_cursor || 0));
  const category = normalizeCategory(campaign.category);

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Inapoi la campanii
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">{campaign.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(category)}`}>{CATEGORY_LABELS[category]}</span>
            <span className="text-xs font-semibold text-muted-foreground">{STATUS_LABELS[campaign.status] || campaign.status}</span>
            {isDraft && dirty && <span className="text-[11px] text-amber-700">Modificari nesalvate</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPause && (
            <button type="button" disabled={busy} onClick={() => setStatus("pause_campaign")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
              Pauzeaza
            </button>
          )}
          {canResume && (
            <button type="button" disabled={busy} onClick={resumeCampaign} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
              {isAutoPaused ? "Reia oricum" : "Reia"}
            </button>
          )}
          {canCancel && (
            <button type="button" disabled={busy} onClick={() => { if (window.confirm("Sigur anulezi campania?")) setStatus("cancel_campaign"); }} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60">
              Anuleaza
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {isAutoPaused && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          <span className="block font-semibold">Campania a fost oprita automat</span>
          <span className="block pt-1">{campaign.failure_message}</span>
          <span className="block pt-1 text-red-800">
            Protectia exista ca sa nu fie oprit tot contul de email (Resend opreste contul peste 4% emailuri respinse sau 0,08% reclamatii de spam).
            Uita-te in raport la adresele respinse inainte sa reiei.
          </span>
        </div>
      )}

      {campaign.failure_message && !isAutoPaused && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Motivul opririi trimiterii: </span>
          {campaign.failure_message}
          {campaign.status === "failed" && (
            <span className="block pt-1 text-amber-800">
              Destinatarii din lotul esuat NU au fost sariti: dupa remedierea cauzei, reia campania si trimiterea continua de unde a ramas.
            </span>
          )}
        </div>
      )}

      {isDraft && (
        <>
          <nav aria-label="Pasii campaniei" className="flex flex-wrap gap-2">
            {STEPS.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={busy}
                onClick={() => goToStep(item.key)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${step === item.key ? "bg-foreground text-background" : "border border-border hover:bg-secondary"}`}
              >
                <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${step === item.key ? "bg-background text-foreground" : "bg-secondary"}`}>
                  {step > item.key ? <Check className="h-3 w-3" /> : item.key}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          {step === 1 && (
            <div className="space-y-4 rounded-2xl border border-border p-5">
              <label className="block">
                <span className="text-xs font-semibold text-foreground">Sablon ({CATEGORY_LABELS[editDraft.category]})</span>
                <select
                  id="outreach-template-select"
                  value={editDraft.template_id || ""}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <option value="">{categoryTemplates.length ? "Alege un sablon…" : "Nu exista sabloane in aceasta categorie"}</option>
                  {categoryTemplates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-muted-foreground">Completeaza subiectul, textul si butonul. Dupa aceea le poti edita aici fara sa modifici sablonul.</span>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-foreground">Subiect</span>
                <input id="outreach-subject" type="text" value={editDraft.subject} onChange={(e) => patchDraft({ subject: e.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-foreground">Continut</span>
                <textarea id="outreach-body" value={editDraft.body_html} onChange={(e) => patchDraft({ body_html: e.target.value })} rows={10} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
                <span className="mt-1 block text-[11px] text-muted-foreground">Campuri completate automat pentru fiecare destinatar: {MERGE_FIELDS_HINT}.</span>
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-foreground">Text buton (optional)</span>
                  <input id="outreach-cta-label" type="text" value={editDraft.cta_label} placeholder="Revendica profilul" onChange={(e) => patchDraft({ cta_label: e.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-foreground">Link buton</span>
                  <input id="outreach-cta-url" type="text" value={editDraft.cta_url} placeholder="https://viasee.ro/adauga-sau-revendica" onChange={(e) => patchDraft({ cta_url: e.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
                  <span className="mt-1 block text-[11px] text-muted-foreground">Butonul apare doar daca linkul e completat (http/https).</span>
                </label>
              </div>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={editDraft.show_listing_preview} onChange={(e) => patchDraft({ show_listing_preview: e.target.checked })} className="mt-0.5" />
                <span className="text-xs text-foreground">
                  Arata in email fisa destinatarului din director
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Fiecare primeste numele, tipul si orasul lui reale, asa cum apar public pe VIASEE. Debifeaza pentru anunturi si pentru emailuri care nu vorbesc despre profil.
                  </span>
                </span>
              </label>
              <details className="rounded-lg border border-border p-3">
                <summary className="cursor-pointer text-xs font-semibold text-foreground">Expeditor si raspunsuri</summary>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-foreground">Nume expeditor</span>
                    <input type="text" value={editDraft.from_name} onChange={(e) => patchDraft({ from_name: e.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-foreground">Email expeditor</span>
                    <input type="text" value={editDraft.from_email} onChange={(e) => patchDraft({ from_email: e.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-foreground">Raspunsurile ajung la</span>
                    <input type="text" value={editDraft.reply_to_email} onChange={(e) => patchDraft({ reply_to_email: e.target.value })} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
                  </label>
                </div>
              </details>
              <StepButtons busy={busy} dirty={dirty} onSave={saveEdits} onNext={() => goToStep(2)} nextLabel="Mai departe: destinatari" />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 rounded-2xl border border-border p-5">
              <OutreachRecipientPicker spec={editDraft} onChange={patchDraft} disabled={busy} />
              <StepButtons busy={busy} dirty={dirty} onSave={saveEdits} onBack={() => goToStep(1)} onNext={() => goToStep(3)} nextLabel="Mai departe: previzualizare" />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 rounded-2xl border border-border p-5">
              <OutreachEmailPreview campaignId={campaignId} draft={editDraft} onBeforeTest={saveEdits} />
              <StepButtons busy={busy} dirty={dirty} onSave={saveEdits} onBack={() => goToStep(2)} onNext={() => goToStep(4)} nextLabel="Mai departe: trimitere" />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 rounded-2xl border border-border p-5">
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs font-semibold text-foreground">Ritm de trimitere</p>
                <p className="text-[11px] text-muted-foreground">
                  Adresa de trimitere e noua: daca pleaca sute de emailuri in aceeasi ora, ajung in Spam.
                  Campania trimite cel mult atatea emailuri pe zi (ora Romaniei) si continua a doua zi la 09:00.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-foreground">Emailuri in prima zi</span>
                    <input
                      id="outreach-daily-limit-draft"
                      type="number"
                      min={DAILY_LIMIT_MIN}
                      max={DAILY_LIMIT_MAX}
                      value={editDraft.daily_send_limit}
                      onChange={(e) => patchDraft({ daily_send_limit: e.target.value })}
                      className="mt-1 block w-28 rounded-lg border border-border px-3 py-1.5 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 pb-1.5 text-xs text-foreground">
                    <input type="checkbox" checked={editDraft.daily_send_ramp} onChange={(e) => patchDraft({ daily_send_ramp: e.target.checked })} />
                    Dubleaza in fiecare zi de trimitere (recomandat)
                  </label>
                </div>
                <SendSchedulePreview total={approvalPreview?.recipientCount ?? campaign.recipient_count} limit={editDraft.daily_send_limit} ramp={editDraft.daily_send_ramp} />
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-4">
                <p className="text-xs font-semibold text-foreground">Aprobare pentru trimitere reala</p>
                <p className="text-[11px] text-muted-foreground">
                  Trimiterea porneste doar dupa ce tastezi exact fraza de confirmare, cu numarul de destinatari
                  recalculat in acel moment din lista de la pasul 2.
                </p>
                {!approvalPreview && (
                  <button type="button" disabled={busy} onClick={openApproval} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
                    Calculeaza destinatarii si pregateste aprobarea
                  </button>
                )}
                {approvalPreview && (
                  <div className="space-y-2">
                    <p className="text-xs text-foreground">
                      {CATEGORY_LABELS[category]} · „{editDraft.subject}” · destinatari acum: <strong>{approvalPreview.recipientCount}</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Tasteaza exact: <code className="rounded bg-background px-1 py-0.5">{approvalPreview.expected}</code>
                    </p>
                    <input
                      id="outreach-confirmation"
                      type="text"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder={approvalPreview.expected}
                    />
                    <button
                      type="button"
                      disabled={busy || confirmationText !== approvalPreview.expected}
                      onClick={confirmApproval}
                      className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-40"
                    >
                      Aproba si porneste trimiterea
                    </button>
                    <p className="text-[11px] text-muted-foreground">Ritmul de trimitere ales mai sus se salveaza odata cu aprobarea.</p>
                  </div>
                )}
              </div>
              <StepButtons busy={busy} dirty={dirty} onSave={saveEdits} onBack={() => goToStep(3)} />
            </div>
          )}
        </>
      )}

      {!isDraft && ["ready", "sending", "paused"].includes(campaign.status) && (
        <div className="space-y-2 rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-foreground">Ritm de trimitere</p>
          <p className="text-xs text-muted-foreground">
            Progres: {campaign.current_cursor || 0} / {campaign.recipient_count || 0} destinatari procesati. Trimiterea avanseaza automat, in loturi mici, la fiecare 5 minute, in limita zilnica.
          </p>
          {sendStats && (
            <p className="text-xs text-foreground">
              Azi: <strong>{sendStats.sent_today}</strong> trimise din <strong>{sendStats.daily_limit_today}</strong> permise
              {sendStats.prior_sending_days > 0 ? ` (a ${sendStats.prior_sending_days + 1}-a zi de trimitere)` : " (prima zi de trimitere)"}.
            </p>
          )}
          {waitingUntil && (
            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground">
              Limita de azi a fost atinsa. Trimiterea continua {waitingUntil.toLocaleString("ro-RO", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-[11px] font-semibold text-foreground">{limitDraft.daily_send_ramp ? "Limita din prima zi" : "Emailuri pe zi"}</span>
              <input
                id="outreach-daily-limit-live"
                type="number"
                min={DAILY_LIMIT_MIN}
                max={DAILY_LIMIT_MAX}
                value={limitDraft.daily_send_limit}
                onChange={(e) => setLimitDraft((d) => ({ ...d, daily_send_limit: e.target.value }))}
                className="mt-1 block w-28 rounded-lg border border-border px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-xs text-foreground">
              <input type="checkbox" checked={limitDraft.daily_send_ramp} onChange={(e) => setLimitDraft((d) => ({ ...d, daily_send_ramp: e.target.checked }))} />
              Dubleaza in fiecare zi de trimitere
            </label>
            <button type="button" disabled={busy} onClick={saveDailyLimit} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
              Salveaza ritmul
            </button>
          </div>
          <SendSchedulePreview
            total={remainingRecipients}
            limit={limitDraft.daily_send_limit}
            ramp={limitDraft.daily_send_ramp}
            startDay={sendStats?.prior_sending_days || 0}
            sentToday={sendStats?.sent_today || 0}
          />
        </div>
      )}

      {!isDraft && <OutreachCampaignReport campaignId={campaignId} campaignName={campaign.name} />}
    </div>
  );
}

function StepButtons({ busy, dirty, onSave, onBack, onNext, nextLabel }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
      {onBack && (
        <button type="button" disabled={busy} onClick={onBack} className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
          Inapoi
        </button>
      )}
      <button type="button" disabled={busy || !dirty} onClick={onSave} className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
        {busy ? "Se salveaza..." : dirty ? "Salveaza" : "Salvat"}
      </button>
      {onNext && (
        <button type="button" disabled={busy} onClick={onNext} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60">
          {nextLabel}
        </button>
      )}
    </div>
  );
}
