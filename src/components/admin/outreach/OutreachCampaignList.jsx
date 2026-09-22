import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import {
  CATEGORY_OPTIONS,
  CATEGORY_LABELS,
  categoryBadgeClass,
  normalizeCategory,
  callOutreach,
  formatPercent,
  formatDateTime,
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

// O campanie oprita automat (prea multe respingeri / reclamatie de spam) trebuie sa sara in ochi
// in lista, nu sa arate ca o pauza obisnuita.
function isAutoPaused(campaign) {
  return campaign.status === "paused" && ["bounce_rate", "complaints"].includes(campaign.pause_reason);
}

function campaignStatusLabel(campaign) {
  if (isAutoPaused(campaign)) return "Oprita automat";
  if (["ready", "sending"].includes(campaign.status) && campaign.next_send_after && new Date(campaign.next_send_after).getTime() > Date.now()) {
    return "Continua maine";
  }
  return STATUS_LABELS[campaign.status] || campaign.status;
}

function statusClass(status) {
  if (status === "sent") return "bg-green-50 text-green-800";
  if (status === "sending" || status === "ready") return "bg-blue-50 text-blue-800";
  if (status === "paused") return "bg-amber-50 text-amber-800";
  if (status === "failed" || status === "cancelled") return "bg-red-50 text-red-800";
  return "bg-secondary text-muted-foreground";
}

function rate(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

const EMPTY_DRAFT = { category: "marketing", template_id: "", name: "", subject: "" };

function OverviewCard({ category, data }) {
  const stats = data || { campaigns: 0, active: 0, sent: 0, delivered: 0, bounced: 0 };
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(category)}`}>
          {category === "announcement" ? "Anunturi" : "Marketing"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {stats.campaigns} {stats.campaigns === 1 ? "campanie" : "campanii"}{stats.active ? ` · ${stats.active} in curs` : ""}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Trimise</dt>
          <dd className="text-lg font-bold tabular-nums text-foreground">{stats.sent}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Livrate</dt>
          <dd className="text-lg font-bold tabular-nums text-foreground">
            {stats.delivered}
            <span className="ml-1 text-[11px] font-semibold text-muted-foreground">{formatPercent(rate(stats.delivered, stats.sent))}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Respinse</dt>
          <dd className={`text-lg font-bold tabular-nums ${stats.bounced ? "text-red-700" : "text-foreground"}`}>{stats.bounced}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function OutreachCampaignList({ onSelect }) {
  const [campaigns, setCampaigns] = useState([]);
  const [overview, setOverview] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    const [list, summary, templateData] = await Promise.all([
      callOutreach("outreachCampaignOps", "list_campaigns"),
      callOutreach("outreachCampaignOps", "outreach_overview"),
      callOutreach("outreachCampaignOps", "list_templates"),
    ]);
    setLoading(false);
    if (list.error) { setError(list.error); return; }
    setCampaigns(list.campaigns || []);
    if (!summary.error) setOverview(summary);
    if (Array.isArray(templateData.templates)) setTemplates(templateData.templates);
  };

  useEffect(() => { load(); }, []);

  const categoryTemplates = useMemo(
    () => templates.filter((template) => normalizeCategory(template.category) === draft.category),
    [templates, draft.category],
  );
  const chosenTemplate = templates.find((template) => template.id === draft.template_id) || null;

  const visibleCampaigns = filter === "all"
    ? campaigns
    : campaigns.filter((campaign) => normalizeCategory(campaign.category) === filter);

  const create = async () => {
    if (!draft.name.trim()) { setError("Da-i campaniei un nume intern."); return; }
    if (!chosenTemplate && !draft.subject.trim()) { setError("Alege un sablon sau scrie subiectul emailului."); return; }
    setSaving(true);
    setError("");
    const data = await callOutreach("outreachCampaignOps", "create_campaign", {
      name: draft.name.trim(),
      category: draft.category,
      template_id: chosenTemplate?.id || "",
      subject: chosenTemplate ? "" : draft.subject.trim(),
      from_name: "VIASEE",
      // from = subdomeniul verificat in Resend; reply_to = casuta reala de pe radacina, livrata prin
      // Cloudflare Email Routing. Vezi DEFAULT_FROM_EMAIL din base44/shared/outreachEmailPolicy.js.
      from_email: "contact@mail.viasee.ro",
      reply_to_email: "contact@viasee.ro",
    });
    setSaving(false);
    if (data.error) { setError(data.error); return; }
    setShowForm(false);
    setDraft(EMPTY_DRAFT);
    await load();
    if (data.campaign?.id) onSelect(data.campaign.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Campanii</h3>
          {overview?.contacts && (
            <p className="text-[11px] text-muted-foreground">
              Destinatari disponibili: {overview.contacts.directory} din director, {overview.contacts.provider_account} {overview.contacts.provider_account === 1 ? "furnizor cu cont" : "furnizori cu cont"}.
              {overview.suppressed && ` Dezabonati: ${overview.suppressed.marketing} de la marketing, ${overview.suppressed.announcement} de la anunturi, ${overview.suppressed.all} de la tot (inclusiv respinsi).`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background"
        >
          <Plus className="h-3.5 w-3.5" /> Campanie noua
        </button>
      </div>

      {overview?.by_category && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OverviewCard category="marketing" data={overview.by_category.marketing} />
          <OverviewCard category="announcement" data={overview.by_category.announcement} />
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {showForm && (
        <div className="space-y-5 rounded-2xl border border-border p-5">
          <div>
            <p className="text-xs font-semibold text-foreground">1. Ce trimiti?</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATEGORY_OPTIONS.map((option) => {
                const active = draft.category === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, category: option.value, template_id: "" }))}
                    className={`rounded-xl border p-3 text-left transition-colors ${active ? "border-foreground bg-secondary/60" : "border-border hover:bg-secondary/40"}`}
                  >
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(option.value)}`}>{option.label}</span>
                    <span className="mt-2 block text-[11px] leading-relaxed text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground">2. Porneste de la un sablon</p>
            <div className="mt-2 space-y-2">
              {categoryTemplates.map((template) => (
                <label
                  key={template.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${draft.template_id === template.id ? "border-foreground bg-secondary/60" : "border-border hover:bg-secondary/40"}`}
                >
                  <input
                    type="radio"
                    name="outreach-new-template"
                    checked={draft.template_id === template.id}
                    onChange={() => setDraft((d) => ({ ...d, template_id: template.id }))}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-foreground">{template.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">Subiect: {template.subject}</span>
                  </span>
                </label>
              ))}
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${!draft.template_id ? "border-foreground bg-secondary/60" : "border-border hover:bg-secondary/40"}`}>
                <input
                  type="radio"
                  name="outreach-new-template"
                  checked={!draft.template_id}
                  onChange={() => setDraft((d) => ({ ...d, template_id: "" }))}
                  className="mt-0.5"
                />
                <span className="text-xs font-semibold text-foreground">Fara sablon, scriu emailul de la zero</span>
              </label>
              {!categoryTemplates.length && (
                <p className="text-[11px] text-muted-foreground">Nu exista inca sabloane pentru aceasta categorie. Le poti adauga din tab-ul Sabloane.</p>
              )}
            </div>
            {!draft.template_id && (
              <label className="mt-3 block">
                <span className="text-xs font-semibold text-foreground">Subiectul emailului</span>
                <input
                  id="outreach-new-subject"
                  type="text"
                  value={draft.subject}
                  onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </label>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-foreground">3. Nume intern</span>
            <input
              id="outreach-new-name"
              type="text"
              value={draft.name}
              placeholder={draft.category === "announcement" ? "Anunt functii noi, octombrie" : "Revendicare, adrese de organizatie"}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">Apare doar aici si in fraza de confirmare de la trimitere.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Creeaza si alege destinatarii
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

      <div className="flex flex-wrap gap-2">
        {[{ value: "all", label: "Toate" }, { value: "marketing", label: "Marketing" }, { value: "announcement", label: "Anunturi" }].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${filter === option.value ? "bg-foreground text-background" : "border border-border hover:bg-secondary"}`}
          >
            {option.label}
          </button>
        ))}
      </div>

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
                <th className="px-3 py-2">Tip</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Destinatari</th>
                <th className="px-3 py-2 text-right">Trimise</th>
                <th className="px-3 py-2 text-right">Livrate</th>
                <th className="px-3 py-2 text-right">Respinse</th>
                <th className="px-3 py-2">Creata</th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((campaign) => (
                <tr
                  key={campaign.id}
                  onClick={() => onSelect(campaign.id)}
                  className="cursor-pointer border-t border-border hover:bg-secondary/40"
                >
                  <td className="px-3 py-2 font-medium text-foreground">{campaign.name}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(campaign.category)}`}>
                      {CATEGORY_LABELS[normalizeCategory(campaign.category)]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isAutoPaused(campaign) ? "bg-red-50 text-red-800" : statusClass(campaign.status)}`}>
                      {campaignStatusLabel(campaign)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{campaign.recipient_count || 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{campaign.sent_count || 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {campaign.delivered_count || 0}
                    {(campaign.sent_count || 0) > 0 && (
                      <span className="ml-1 text-muted-foreground">({formatPercent(rate(campaign.delivered_count || 0, campaign.sent_count))})</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${(campaign.bounced_count || 0) > 0 ? "text-red-700" : ""}`}>{campaign.bounced_count || 0}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(campaign.created_date)}</td>
                </tr>
              ))}
              {!visibleCampaigns.length && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nicio campanie in aceasta categorie.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
