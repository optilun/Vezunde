import React, { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
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

function statusClass(status) {
  if (status === "sent") return "bg-green-50 text-green-800";
  if (status === "sending" || status === "ready") return "bg-blue-50 text-blue-800";
  if (status === "paused") return "bg-amber-50 text-amber-800";
  if (status === "failed" || status === "cancelled") return "bg-red-50 text-red-800";
  return "bg-secondary text-muted-foreground";
}

const EMPTY_DRAFT = {
  name: "",
  campaign_type: "marketing",
  subject: "",
  body_html: "",
  from_name: "VIASEE",
  from_email: "contact@viasee.ro",
  reply_to_email: "contact@viasee.ro",
  target_counties: [],
  target_provider_types: [],
  target_profile_control_status: [],
  target_tags: [],
};

export default function OutreachCampaignList({ onSelect }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    const response = await base44.functions.invoke("outreachCampaignOps", { action: "list_campaigns" })
      .catch((err) => ({ data: { error: err.response?.data?.error || err.message } }));
    setLoading(false);
    if (response.data?.error) { setError(response.data.error); return; }
    setCampaigns(response.data?.campaigns || []);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.name.trim() || !draft.subject.trim()) {
      setError("Numele si subiectul sunt obligatorii.");
      return;
    }
    setSaving(true);
    setError("");
    const response = await base44.functions.invoke("outreachCampaignOps", { action: "create_campaign", ...draft })
      .catch((err) => ({ data: { error: err.response?.data?.error || err.message } }));
    setSaving(false);
    if (response.data?.error) { setError(response.data.error); return; }
    setShowForm(false);
    setDraft(EMPTY_DRAFT);
    await load();
    if (response.data?.campaign?.id) onSelect(response.data.campaign.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">Campanii de outreach</h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
        >
          <Plus className="h-3.5 w-3.5" /> Campanie noua
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {showForm && (
        <div className="space-y-4 rounded-2xl border border-border p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Nume intern campanie</span>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Tip campanie</span>
              <select
                value={draft.campaign_type}
                onChange={(e) => setDraft((d) => ({ ...d, campaign_type: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              >
                <option value="marketing">Marketing</option>
                <option value="claim_notice">Notificare revendicare</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-foreground">Subiect email</span>
            <input
              type="text"
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-foreground">Continut email</span>
            <textarea
              value={draft.body_html}
              onChange={(e) => setDraft((d) => ({ ...d, body_html: e.target.value }))}
              rows={8}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm font-mono"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Nume expeditor</span>
              <input
                type="text"
                value={draft.from_name}
                onChange={(e) => setDraft((d) => ({ ...d, from_name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Email expeditor</span>
              <input
                type="text"
                value={draft.from_email}
                onChange={(e) => setDraft((d) => ({ ...d, from_email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">Domeniul trebuie verificat in Resend</span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Reply-to</span>
              <input
                type="text"
                value={draft.reply_to_email}
                onChange={(e) => setDraft((d) => ({ ...d, reply_to_email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-foreground">Audienta tinta</span>
            <div className="mt-2">
              <OutreachAudienceBuilder
                filters={draft}
                onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Creeaza ciorna
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setDraft(EMPTY_DRAFT); }}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Renunta
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Se incarca...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Nume</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Destinatari</th>
                <th className="px-3 py-2">Trimise</th>
                <th className="px-3 py-2">Deschise</th>
                <th className="px-3 py-2">Click</th>
                <th className="px-3 py-2">Respinse</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  onClick={() => onSelect(campaign.id)}
                  className="cursor-pointer border-t border-border hover:bg-secondary/40"
                >
                  <td className="px-3 py-2 font-medium text-foreground">{campaign.name}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(campaign.status)}`}>
                      {STATUS_LABELS[campaign.status] || campaign.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{campaign.recipient_count || 0}</td>
                  <td className="px-3 py-2">{campaign.sent_count || 0}</td>
                  <td className="px-3 py-2">{campaign.opened_count || 0}</td>
                  <td className="px-3 py-2">{campaign.clicked_count || 0}</td>
                  <td className="px-3 py-2">{campaign.bounced_count || 0}</td>
                </tr>
              ))}
              {!campaigns.length && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nicio campanie inca.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
