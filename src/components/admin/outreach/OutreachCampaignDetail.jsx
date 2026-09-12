import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import OutreachAudienceBuilder from "./OutreachAudienceBuilder";

const STATUS_LABELS = {
  draft: "Ciorna",
  ready: "Pregatita",
  sending: "Se trimite",
  sent: "Trimisa",
  paused: "Pausata",
  failed: "Esuata",
  cancelled: "Anulata",
};

const LOG_STATUS_LABELS = {
  pending: "In asteptare",
  sent: "Trimis",
  delivered: "Livrat",
  delivery_delayed: "Livrare intarziata",
  bounced: "Respins (bounce)",
  complained: "Plangere spam",
  failed: "Esuat",
  invalid: "Email invalid",
  skipped: "Sarit (suprimat)",
  duplicate: "Duplicat",
  unsubscribed: "Dezabonat",
  replied: "A raspuns",
  unknown: "Necunoscut",
};

async function callOutreach(logicalName, action, payload = {}) {
  try {
    const response = await base44.functions.invoke(logicalName, { action, ...payload });
    return response.data || {};
  } catch (err) {
    return err.response?.data || { error: err.message };
  }
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-border p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value ?? 0}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function OutreachCampaignDetail({ campaignId, onBack }) {
  const [campaign, setCampaign] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [editDraft, setEditDraft] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const [approvalPreview, setApprovalPreview] = useState(null);
  const [confirmationText, setConfirmationText] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    const data = await callOutreach("outreachCampaignOps", "get_campaign", { id: campaignId, log_limit: 300 });
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setCampaign(data.campaign);
    setLogs(data.logs || []);
    setEditDraft({
      subject: data.campaign.subject || "",
      body_html: data.campaign.body_html || "",
      from_name: data.campaign.from_name || "VIASEE",
      from_email: data.campaign.from_email || "",
      reply_to_email: data.campaign.reply_to_email || "",
      target_counties: data.campaign.target_counties || [],
      target_provider_types: data.campaign.target_provider_types || [],
      target_profile_control_status: data.campaign.target_profile_control_status || [],
      target_tags: data.campaign.target_tags || [],
    });
  };

  useEffect(() => { load(); }, [campaignId]);

  const saveEdits = async () => {
    setBusy(true);
    setError("");
    const data = await callOutreach("outreachCampaignOps", "update_campaign", { id: campaignId, ...editDraft });
    setBusy(false);
    if (data.error) { setError(data.error); return; }
    await load();
  };

  const runPreview = async () => {
    setPreviewing(true);
    const data = await callOutreach("outreachCampaignOps", "preview_segment", editDraft);
    setPreviewing(false);
    if (data.error) { setError(data.error); return; }
    setPreviewResult(data);
  };

  const openApproval = async () => {
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

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestStatus("sending");
    const data = await callOutreach("outreachSendOps", "send_test_email", { campaign_id: campaignId, to_email: testEmail.trim() });
    setTestStatus(data.error ? `Eroare: ${data.error}` : "Trimis cu succes.");
  };

  const markReplied = async (log) => {
    await callOutreach("outreachCampaignOps", "mark_replied", { log_id: log.id, contact_id: log.contact_id });
    await load();
  };

  if (loading || !campaign) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Se incarca campania...
      </div>
    );
  }

  const isDraft = campaign.status === "draft";
  const canPause = ["ready", "sending"].includes(campaign.status);
  const canResume = campaign.status === "paused";
  const canCancel = ["draft", "ready", "sending", "paused"].includes(campaign.status);

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Inapoi la campanii
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">{campaign.name}</h2>
          <span className="text-xs font-semibold text-muted-foreground">{STATUS_LABELS[campaign.status] || campaign.status}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPause && (
            <button type="button" disabled={busy} onClick={() => setStatus("pause_campaign")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
              Pauzeaza
            </button>
          )}
          {canResume && (
            <button type="button" disabled={busy} onClick={() => setStatus("resume_campaign")} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
              Reia
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Destinatari" value={campaign.recipient_count} />
        <StatCard label="Trimise" value={campaign.sent_count} />
        <StatCard label="Livrate" value={campaign.delivered_count} />
        <StatCard label="Deschise" value={campaign.opened_count} />
        <StatCard label="Click" value={campaign.clicked_count} />
        <StatCard label="Respinse" value={campaign.bounced_count} />
        <StatCard label="Plangeri" value={campaign.complained_count} />
        <StatCard label="Esuate" value={campaign.failed_count} />
      </div>

      {!isDraft && ["ready", "sending", "paused"].includes(campaign.status) && (
        <p className="text-xs text-muted-foreground">
          Progres trimitere: {campaign.current_cursor || 0} / {campaign.recipient_count || 0} destinatari procesati.
          Trimiterea avanseaza automat, in loturi mici, la fiecare 5 minute.
        </p>
      )}

      {isDraft && editDraft && (
        <div className="space-y-4 rounded-2xl border border-border p-5">
          <h3 className="text-sm font-bold text-foreground">Editeaza campania (ciorna)</h3>
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Subiect</span>
            <input type="text" value={editDraft.subject} onChange={(e) => setEditDraft((d) => ({ ...d, subject: e.target.value }))} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Continut</span>
            <textarea value={editDraft.body_html} onChange={(e) => setEditDraft((d) => ({ ...d, body_html: e.target.value }))} rows={8} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-mono" />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Nume expeditor</span>
              <input type="text" value={editDraft.from_name} onChange={(e) => setEditDraft((d) => ({ ...d, from_name: e.target.value }))} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Email expeditor</span>
              <input type="text" value={editDraft.from_email} onChange={(e) => setEditDraft((d) => ({ ...d, from_email: e.target.value }))} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Reply-to</span>
              <input type="text" value={editDraft.reply_to_email} onChange={(e) => setEditDraft((d) => ({ ...d, reply_to_email: e.target.value }))} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
          </div>
          <OutreachAudienceBuilder filters={editDraft} onChange={(next) => setEditDraft((d) => ({ ...d, ...next }))} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy} onClick={saveEdits} className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60">
              Salveaza modificarile
            </button>
            <button type="button" disabled={previewing} onClick={runPreview} className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60">
              {previewing ? "Se calculeaza..." : "Previzualizeaza segmentul"}
            </button>
          </div>
          {previewResult && (
            <div className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
              <p>{previewResult.contacts_eligible_for_send} contacte eligibile pentru trimitere din {previewResult.contacts_materialized_matching} materializate.</p>
              <p>{previewResult.not_yet_materialized} locatii din director inca nu au fost materializate ca si contacte (vezi tab-ul Contacte).</p>
              <p>{previewResult.contacts_suppressed} contacte suprimate (dezabonate/bounce/plangere), {previewResult.contacts_missing_compliance_metadata} fara metadate complete de conformitate.</p>
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-semibold text-foreground">Trimite un test</p>
            <div className="flex flex-wrap gap-2">
              <input type="email" placeholder="adresa@exemplu.ro" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="rounded-lg border border-border px-3 py-1.5 text-xs" />
              <button type="button" onClick={sendTest} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                <Send className="h-3 w-3" /> Trimite test
              </button>
            </div>
            {testStatus && <p className="text-[11px] text-muted-foreground">{testStatus}</p>}
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-xs font-semibold text-foreground">Aprobare pentru trimitere reala</p>
            <p className="text-[11px] text-muted-foreground">
              Trimiterea reala porneste doar dupa ce tastezi exact fraza de confirmare afisata mai jos,
              cu numarul de destinatari eligibili recalculat in acel moment.
            </p>
            {!approvalPreview && (
              <button type="button" onClick={openApproval} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
                Calculeaza destinatari si pregateste aprobarea
              </button>
            )}
            {approvalPreview && (
              <div className="space-y-2">
                <p className="text-xs text-foreground">
                  Destinatari eligibili acum: <strong>{approvalPreview.recipientCount}</strong>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Tasteaza exact: <code className="rounded bg-background px-1 py-0.5">{approvalPreview.expected}</code>
                </p>
                <input
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
                  Aproba si pregateste trimiterea
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold text-foreground">Jurnal trimitere ({logs.length})</h3>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Motiv / eroare</th>
                <th className="px-3 py-2">Actualizat</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border">
                  <td className="px-3 py-2">{log.email}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {LOG_STATUS_LABELS[log.status] || log.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{log.error || log.reason || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(log.sent_at || log.delivered_at || log.created_at || 0).toLocaleString("ro-RO")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {["sent", "delivered", "delivery_delayed"].includes(log.status) && (
                      <button type="button" onClick={() => markReplied(log)} className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold hover:bg-secondary">
                        A raspuns
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!logs.length && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Inca nu s-a trimis nimic.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
