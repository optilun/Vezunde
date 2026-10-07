import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mail, Plus } from "lucide-react";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import {
  CATEGORY_OPTIONS,
  CATEGORY_LABELS,
  categoryBadgeClass,
  normalizeCategory,
  callOutreach,
  campaignStatusLabel,
  campaignStatusTone,
  isAutoPausedCampaign,
  formatPercent,
  formatDateTime,
} from "./outreachLabels";

// O campanie care continuă mâine (limita zilnică a fost atinsă) nu arată ca o pauză obișnuită.
function statusOf(campaign) {
  if (isAutoPausedCampaign(campaign)) return { label: "Oprită automat", tone: "danger" };
  if (["ready", "sending"].includes(campaign.status) && campaign.next_send_after && new Date(campaign.next_send_after).getTime() > Date.now()) {
    return { label: "Continuă mâine", tone: "info" };
  }
  return { label: campaignStatusLabel(campaign.status), tone: campaignStatusTone(campaign.status) };
}

function rate(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

const EMPTY_DRAFT = { category: "marketing", template_id: "", name: "", subject: "" };

function OverviewCard({ category, data }) {
  const stats = data || { campaigns: 0, active: 0, sent: 0, delivered: 0, bounced: 0 };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(category)}`}>
          {category === "announcement" ? "Anunțuri" : "Marketing"}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {stats.campaigns} {stats.campaigns === 1 ? "campanie" : "campanii"}{stats.active ? ` · ${stats.active} în curs` : ""}
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
          <dd className={`text-lg font-bold tabular-nums ${stats.bounced ? "text-danger" : "text-foreground"}`}>{stats.bounced}</dd>
        </div>
      </dl>
    </div>
  );
}

// Pentru prima campanie: pașii în ordine, cu butonul care pornește chiar primul pas.
function FirstCampaignGuide({ recipients, onStart }) {
  const steps = [
    ["Alegi ce trimiți", "Marketing (invitații) sau anunț, pornind de la un șablon."],
    ["Alegi destinatarii", "Filtre după județ și tip, sau adrese alese manual."],
    ["Îți trimiți un test", "Vezi emailul exact cum ajunge, înainte de trimitere."],
    ["Aprobi trimiterea", "Tastezi fraza de confirmare; emailurile pleacă treptat, nu toate odată."],
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"><Mail className="h-5 w-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <h4 className="text-sm font-bold">Prima ta campanie</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {recipients > 0 ? `Ai ${recipients} contacte din director gata de folosit.` : "Contactele din director se pregătesc din fila „Contacte”."}
          </p>
        </div>
      </div>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {steps.map(([title, text], index) => (
          <li key={title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">{index + 1}</span>
            <span className="min-w-0 text-xs"><strong className="block text-sm font-semibold text-foreground">{title}</strong><span className="text-muted-foreground">{text}</span></span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onStart}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background sm:min-h-10"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Pornește prima campanie
      </button>
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
  const formRef = useRef(null);

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

  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [showForm]);

  const categoryTemplates = useMemo(
    () => templates.filter((template) => normalizeCategory(template.category) === draft.category),
    [templates, draft.category],
  );
  const chosenTemplate = templates.find((template) => template.id === draft.template_id) || null;

  const counts = useMemo(() => ({
    all: campaigns.length,
    marketing: campaigns.filter((campaign) => normalizeCategory(campaign.category) === "marketing").length,
    announcement: campaigns.filter((campaign) => normalizeCategory(campaign.category) === "announcement").length,
  }), [campaigns]);
  const visibleCampaigns = filter === "all"
    ? campaigns
    : campaigns.filter((campaign) => normalizeCategory(campaign.category) === filter);

  const create = async () => {
    if (!draft.name.trim()) { setError("Dă-i campaniei un nume intern."); return; }
    if (!chosenTemplate && !draft.subject.trim()) { setError("Alege un șablon sau scrie subiectul emailului."); return; }
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

  const available = overview?.contacts;
  const filterOptions = [
    { key: "all", label: "Toate", count: counts.all },
    { key: "marketing", label: "Marketing", count: counts.marketing },
    { key: "announcement", label: "Anunțuri", count: counts.announcement },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-foreground">Campanii</h3>
            {overview?.suppressed && (
              <AdminHint label="Cine nu primește emailuri">
                Dezabonați: {overview.suppressed.marketing} de la marketing, {overview.suppressed.announcement} de la anunțuri, {overview.suppressed.all} de la tot (inclusiv respinși). Ei sunt excluși automat din orice campanie.
              </AdminHint>
            )}
          </div>
          {available && (
            <p className="text-[11px] text-muted-foreground">
              Destinatari disponibili: {available.directory} din director, {available.provider_account} {available.provider_account === 1 ? "furnizor cu cont" : "furnizori cu cont"}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background sm:min-h-10"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Campanie nouă
        </button>
      </div>

      {error && <AdminNotice tone="danger">{error}</AdminNotice>}

      {!loading && campaigns.length === 0 && !showForm && !error && (
        <FirstCampaignGuide recipients={available?.directory || 0} onStart={() => setShowForm(true)} />
      )}

      {overview?.by_category && campaigns.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <OverviewCard category="marketing" data={overview.by_category.marketing} />
          <OverviewCard category="announcement" data={overview.by_category.announcement} />
        </div>
      )}

      {showForm && (
        <div ref={formRef} className="scroll-mt-20 space-y-5 rounded-2xl border border-border bg-card p-5">
          <div>
            <p className="text-xs font-semibold text-foreground">1. Ce trimiți?</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CATEGORY_OPTIONS.map((option) => {
                const active = draft.category === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
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
            <p className="text-xs font-semibold text-foreground">2. Pornește de la un șablon</p>
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
                    className="mt-0.5 h-4 w-4 shrink-0"
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
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span className="text-xs font-semibold text-foreground">Fără șablon, scriu emailul de la zero</span>
              </label>
              {!categoryTemplates.length && (
                <p className="text-[11px] text-muted-foreground">Nu există încă șabloane pentru această categorie. Le poți adăuga din fila „Șabloane marketing”.</p>
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
                  className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm"
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
              placeholder={draft.category === "announcement" ? "Anunț funcții noi, octombrie" : "Revendicare, adrese de organizație"}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">Apare doar aici și în fraza de confirmare de la trimitere.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={create}
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-60 sm:min-h-10"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Creează și alege destinatarii
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setDraft(EMPTY_DRAFT); }}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary sm:min-h-10"
            >
              Renunță
            </button>
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <AdminChips options={filterOptions} value={filter} onChange={setFilter} label="Filtrează campaniile" />
      )}

      {loading ? (
        <AdminLoading label="Se încarcă campaniile…" rows={2} />
      ) : campaigns.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
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
                <th className="px-3 py-2">Creată</th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((campaign) => {
                const status = statusOf(campaign);
                return (
                  <tr
                    key={campaign.id}
                    onClick={() => onSelect(campaign.id)}
                    className="cursor-pointer border-t border-border hover:bg-secondary/40"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onSelect(campaign.id); }}
                        className="text-left font-medium underline-offset-2 hover:underline"
                      >
                        {campaign.name}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${categoryBadgeClass(campaign.category)}`}>
                        {CATEGORY_LABELS[normalizeCategory(campaign.category)]}
                      </span>
                    </td>
                    <td className="px-3 py-2"><StatusBadge label={status.label} tone={status.tone} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{campaign.recipient_count || 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{campaign.sent_count || 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {campaign.delivered_count || 0}
                      {(campaign.sent_count || 0) > 0 && (
                        <span className="ml-1 text-muted-foreground">({formatPercent(rate(campaign.delivered_count || 0, campaign.sent_count))})</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${(campaign.bounced_count || 0) > 0 ? "font-semibold text-danger" : ""}`}>{campaign.bounced_count || 0}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(campaign.created_date)}</td>
                  </tr>
                );
              })}
              {!visibleCampaigns.length && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nicio campanie în această categorie.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
