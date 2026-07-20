import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Clock3, HelpCircle, Inbox, Loader2, LockKeyhole, MapPin, RefreshCw, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderLeadContactAccess from "./ProviderLeadContactAccess";
import ProviderLeadChat from "./ProviderLeadChat";
import ProviderStatusCenter from "./ProviderStatusCenter";
import ProviderNotificationCenter from "@/components/notifications/ProviderNotificationCenter";

const FILTERS = [
  { key: "all", label: "Active", scope: "active", status: "" },
  { key: "new", label: "Noi", scope: "active", status: "new" },
  { key: "viewed", label: "Vazute", scope: "active", status: "viewed" },
  { key: "interested", label: "Putem ajuta", scope: "active", status: "interested" },
  { key: "needs_details", label: "Detalii necesare", scope: "active", status: "needs_details" },
  { key: "declined", label: "Nu putem ajuta", scope: "active", status: "declined" },
  { key: "history", label: "Incheiate", scope: "history", status: "" },
];

const RESPONSE_OPTIONS = [
  { key: "can_help", label: "Putem ajuta", icon: CheckCircle2 },
  { key: "needs_details", label: "Avem nevoie de detalii", icon: HelpCircle },
  { key: "cannot_help", label: "Nu putem ajuta", icon: XCircle },
];

const TERMINAL_NOTIFICATION_EVENTS = new Set(["provider_request_resolved", "provider_request_closed", "provider_request_expired"]);
const FREE_ENTITLEMENT = { plan_code: "free", status: "free", feature_keys: [] };

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

function formatDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Data indisponibila";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function serviceLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function LeadCard({ lead, response, locationId, canRespond, canAccessContact, canChat, onMarkViewed, onRespond, marking, responding }) {
  const terminal = lead.is_historical === true;
  const services = lead.matched_service_keys?.length ? lead.matched_service_keys : lead.service_keys || [];
  const details = lead.full_details;

  return (
    <article id={`provider-lead-${lead.id}`} className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 shadow-[0_12px_36px_rgba(23,23,23,0.035)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-extrabold tracking-tight text-foreground">{lead.intent_label || "Cerere client"}</h3>
            {lead.status === "new" && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">Nou</span>}
            {terminal && <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground"><Archive className="h-3 w-3" /> Incheiata</span>}
            {response?.response_label && <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">{response.response_label}</span>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lead.preview_summary || "Rezumatul cererii nu este disponibil."}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {formatDate(lead.created_date)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">{services.slice(0, 5).map((service) => <span key={service} className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-semibold text-foreground">{serviceLabel(service)}</span>)}</div>
      <div className="mt-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{[lead.city, lead.county].filter(Boolean).join(", ") || "Localitate indisponibila"}</span></div>

      {terminal ? (
        <div className="mt-5 rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-relaxed text-muted-foreground">Cererea este disponibila numai in istoric. Datele private si actiunile noi sunt retrase.</div>
      ) : lead.full_details_status?.available && details ? (
        <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Detalii Pro · Top 3</p>
          <p className="mt-3 font-semibold">{details.client_name || "Nume indisponibil"}</p>
          <p className="mt-1 break-all text-muted-foreground">{details.client_email || "Email neconfirmat sau necompletat"}</p>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed">{details.detailed_message}</p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-relaxed text-muted-foreground">{lead.access_tier === "pro_full" ? "Lead Top 3: detaliile complete necesita plan Pro activ si eligibilitate actuala." : "Rezumat anonim. Detaliile complete si chatul sunt disponibile numai pentru locatiile Pro eligibile din Top 3."}</div>
      )}

      {canRespond && !terminal && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-bold text-foreground">Raspunsul locatiei</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">{RESPONSE_OPTIONS.map((option) => { const Icon = option.icon; const selected = response?.response_type === option.key; return <button key={option.key} type="button" onClick={() => onRespond(lead.id, option.key)} disabled={responding} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold ${selected ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground"}`}>{responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{option.label}</button>; })}</div>
          <p className="mt-3 text-[11px] text-muted-foreground">Raspunsul nu distribuie automat telefonul si nu deschide unilateral chatul.</p>
        </div>
      )}

      {!terminal && <ProviderLeadContactAccess leadId={lead.id} locationId={locationId} enabled={canAccessContact && details?.phone_available_for_request === true} responseType={response?.response_type || ""} />}
      <ProviderLeadChat leadId={lead.id} locationId={locationId} enabled={canChat && lead.access_tier === "pro_full"} responseType={response?.response_type || ""} terminal={terminal} />

      {!terminal && lead.status === "new" && !response && <div className="mt-5 border-t border-border pt-4 text-right"><button type="button" onClick={() => onMarkViewed(lead.id)} disabled={marking} className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-xs font-bold">{marking && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Marcheaza ca vazut</button></div>}
    </article>
  );
}

export default function ProviderLeadInbox({ locationId, location }) {
  const [data, setData] = useState(null);
  const [entitlement, setEntitlement] = useState(FREE_ENTITLEMENT);
  const [responsesByLead, setResponsesByLead] = useState({});
  const [filter, setFilter] = useState("all");
  const [pendingTargetId, setPendingTargetId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState("");
  const [respondingId, setRespondingId] = useState("");

  const canRespond = entitlement.plan_code === "pro" && entitlement.feature_keys?.includes("provider_leads.respond");
  const canAccessContact = entitlement.plan_code === "pro" && entitlement.feature_keys?.includes("provider_contact.access_after_consent");
  const canChat = entitlement.plan_code === "pro" && entitlement.feature_keys?.includes("provider_chat.access");

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true); setError("");
    try {
      const selected = FILTERS.find((item) => item.key === filter) || FILTERS[0];
      const inboxData = await base44.functions.invoke("providerLeadInboxOps", { action: "list", location_id: locationId, scope: selected.scope, status: selected.status, limit: 100 }).then(responseData);
      setData(inboxData);
      const nextEntitlement = inboxData.entitlement || FREE_ENTITLEMENT;
      setEntitlement(nextEntitlement);
      if (nextEntitlement.plan_code === "pro" && nextEntitlement.feature_keys?.includes("provider_leads.respond")) {
        const rows = await base44.functions.invoke("providerLeadResponseOps", { action: "list", location_id: locationId }).then(responseData);
        setResponsesByLead(Object.fromEntries((rows.responses || []).map((row) => [row.lead_id, row])));
      } else setResponsesByLead({});
    } catch (loadError) { setError(loadError?.message || "Leadurile nu au putut fi incarcate."); }
    finally { setLoading(false); }
  }, [filter, locationId]);

  useEffect(() => { void load(); }, [load]);
  const leads = useMemo(() => data?.leads || [], [data?.leads]);
  useEffect(() => { if (!pendingTargetId || loading) return; const target = document.getElementById(`provider-lead-${pendingTargetId}`); if (target) { target.scrollIntoView({ behavior: "smooth", block: "start" }); setPendingTargetId(""); } }, [leads, loading, pendingTargetId]);

  const openNotificationTarget = useCallback((notification) => { if (!notification?.action_target_id) return; setFilter(TERMINAL_NOTIFICATION_EVENTS.has(notification.event_key) ? "history" : "all"); setPendingTargetId(notification.action_target_id); }, []);
  const markViewed = async (leadId) => { setMarkingId(leadId); try { await base44.functions.invoke("providerLeadInboxOps", { action: "mark_viewed", location_id: locationId, lead_id: leadId }).then(responseData); await load(); } catch (e) { setError(e.message); } finally { setMarkingId(""); } };
  const submitResponse = async (leadId, responseType) => { setRespondingId(leadId); try { await base44.functions.invoke("providerLeadResponseOps", { action: "submit", location_id: locationId, lead_id: leadId, response_type: responseType }).then(responseData); await load(); } catch (e) { setError(e.message); } finally { setRespondingId(""); } };

  const locationName = data?.location?.name || location?.public_display_name || location?.name || "Locatia selectata";
  const statusLocation = { ...(location || {}), ...(data?.location || {}) };

  return <section className="space-y-6">
    <header className="rounded-[22px] border border-foreground/10 bg-card p-6 shadow-[0_14px_40px_rgba(23,23,23,0.04)]"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Inbox className="h-4 w-4" /> Inbox furnizor</div><h1 className="mt-2 font-heading text-2xl font-extrabold">Leaduri</h1><p className="mt-2 text-sm text-muted-foreground">Cereri relevante pentru {locationName}.</p></div><div className="flex gap-2"><ProviderNotificationCenter locationId={locationId} onOpenTarget={openNotificationTarget} /><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-xs font-bold"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizeaza</button></div></div></header>

    <ProviderStatusCenter location={statusLocation} entitlement={entitlement} counters={data?.counters || {}} />

    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Leaduri noi</p><p className="mt-1 text-2xl font-extrabold">{data?.counters?.new || 0}</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Active</p><p className="mt-1 text-2xl font-extrabold">{data?.counters?.active || 0}</p></div><div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">In istoric</p><p className="mt-1 text-2xl font-extrabold">{data?.counters?.history || 0}</p></div></div>
    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm"><div className="flex gap-3"><LockKeyhole className="mt-0.5 h-4 w-4 text-primary" /><p><strong>Acces controlat.</strong> Free vede rezumatul anonim. Pro primeste detalii numai in Top 3 si cu acordurile necesare.</p></div></div>
    <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full px-4 py-2 text-xs font-bold ${filter === item.key ? "bg-foreground text-background" : "border border-border bg-card"}`}>{item.label}</button>)}</div>
    {error && <p role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {loading ? <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca leadurile...</div> : leads.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><Inbox className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-heading text-lg font-extrabold">Nu exista leaduri in aceasta categorie</h2></div> : <div className="space-y-4">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} response={responsesByLead[lead.id] || null} locationId={locationId} canRespond={canRespond} canAccessContact={canAccessContact} canChat={canChat} onMarkViewed={markViewed} onRespond={submitResponse} marking={markingId === lead.id} responding={respondingId === lead.id} />)}</div>}
  </section>;
}
