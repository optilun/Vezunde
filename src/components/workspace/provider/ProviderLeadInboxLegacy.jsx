import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Inbox,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderLeadContactAccess from "./ProviderLeadContactAccess";
import ProviderLeadChat from "./ProviderLeadChat";
import ProviderNotificationCenter from "@/components/notifications/ProviderNotificationCenter";

const FILTERS = [
  { key: "all", label: "Active", scope: "active", status: "" },
  { key: "new", label: "Noi", scope: "active", status: "new" },
  { key: "viewed", label: "Văzute", scope: "active", status: "viewed" },
  { key: "interested", label: "Putem ajuta", scope: "active", status: "interested" },
  { key: "needs_details", label: "Detalii necesare", scope: "active", status: "needs_details" },
  { key: "declined", label: "Nu putem ajuta", scope: "active", status: "declined" },
  { key: "history", label: "Încheiate", scope: "history", status: "" },
];

const RESPONSE_OPTIONS = [
  { key: "can_help", label: "Putem ajuta", icon: CheckCircle2 },
  { key: "needs_details", label: "Avem nevoie de detalii", icon: HelpCircle },
  { key: "cannot_help", label: "Nu putem ajuta", icon: XCircle },
];

const TERMINAL_NOTIFICATION_EVENTS = new Set([
  "provider_request_resolved",
  "provider_request_closed",
  "provider_request_expired",
]);

const CLOSURE_PRESENTATION = {
  request_resolved: {
    title: "Cerere rezolvată de client",
    description: "Clientul a confirmat că și-a rezolvat nevoia. Răspunsurile și conversația rămân doar în istoric.",
  },
  request_closed: {
    title: "Cerere închisă de client",
    description: "Cererea nu mai acceptă răspunsuri, mesaje sau acces la date de contact.",
  },
  request_expired: {
    title: "Cerere expirată",
    description: "Perioada activă s-a încheiat automat. Datele de contact nu mai sunt disponibile.",
  },
};

const FREE_ENTITLEMENT = { plan_code: "free", status: "free", feature_keys: [] };

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { status: response?.status || 0 });
  return data;
}

function formatDate(value) {
  if (!value) return "Dată indisponibilă";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Dată indisponibilă";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function serviceLabel(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function FullDetails({ lead }) {
  if (lead.is_historical) {
    return (
      <div className="mt-5 rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-relaxed text-muted-foreground">
        Datele private ale clientului nu mai sunt disponibile după încheierea cererii. Istoricul chatului rămâne separat, numai pentru locațiile Pro eligibile.
      </div>
    );
  }

  const details = lead.full_details;
  if (lead.full_details_status?.available && details) {
    return (
      <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-primary">Detalii Pro · Top 3</p>
          <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">Acces auditat</span>
        </div>
        <div className="mt-4 grid gap-3 text-sm">
          <div className="flex items-start gap-2">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Client</p><p className="font-semibold text-foreground">{details.client_name || "Nume indisponibil"}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Email verificat</p><p className="break-all font-semibold text-foreground">{details.client_email || "Email neconfirmat sau necompletat"}</p></div>
          </div>
          <div className="flex items-start gap-2">
            <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mesajul clientului</p><p className="whitespace-pre-wrap leading-relaxed text-foreground">{details.detailed_message}</p></div>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          {details.phone_available_for_request
            ? "Clientul a lăsat și un număr de telefon. Numărul rămâne ascuns și poate fi solicitat separat."
            : "Clientul nu a lăsat un număr de telefon. Comunicarea poate continua prin email și prin chatul VIASEE deschis de client."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-xl border border-border bg-secondary/35 p-4 text-xs leading-relaxed text-muted-foreground">
      {lead.access_tier === "pro_full"
        ? "Acest lead este în Top 3, dar detaliile complete necesită plan Pro activ și acordul actual al clientului."
        : "Acest lead este disponibil ca rezumat anonim. Detaliile complete și chatul sunt rezervate locațiilor Pro din Top 3."}
    </div>
  );
}

function LeadCard({ lead, response, locationId, canRespond, canAccessContact, canChat, onMarkViewed, onRespond, marking, responding }) {
  const services = lead.matched_service_keys?.length ? lead.matched_service_keys : lead.service_keys;
  const terminal = lead.is_historical === true;
  const closure = CLOSURE_PRESENTATION[lead.closure_reason] || {
    title: lead.status === "expired" ? "Cerere expirată" : "Cerere încheiată",
    description: "Cererea nu mai acceptă acțiuni noi. Informațiile disponibile sunt păstrate numai ca istoric.",
  };

  return (
    <article id={`provider-lead-${lead.id}`} className={`scroll-mt-24 rounded-2xl border bg-card p-5 shadow-[0_12px_36px_rgba(23,23,23,0.035)] ${terminal ? "border-border/70" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-extrabold tracking-tight text-foreground">{lead.intent_label || "Cerere client"}</h3>
            {lead.status === "new" && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">Nou</span>}
            {terminal && <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-foreground"><Archive className="h-3 w-3" /> Încheiată</span>}
            {response?.response_label && <span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-background">{response.response_label}</span>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{lead.preview_summary || "Rezumatul cererii nu este disponibil."}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {formatDate(lead.created_date)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(services || []).slice(0, 5).map((service) => <span key={service} className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-semibold text-foreground">{serviceLabel(service)}</span>)}
      </div>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="inline-flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" />{[lead.city, lead.county].filter(Boolean).join(", ") || "Localitate indisponibilă"}</span>
        <span>{lead.for_whom === "copil" ? "Pentru copil" : "Pentru adult"}</span>
      </div>

      {terminal && (
        <div className="mt-5 rounded-2xl border border-border bg-secondary/35 p-4">
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground"><Archive className="h-4 w-4 text-primary" /> {closure.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{closure.description}</p>
          {lead.closed_at && <p className="mt-2 text-[11px] text-muted-foreground">Încheiată la {formatDate(lead.closed_at)}</p>}
        </div>
      )}

      <FullDetails lead={lead} />

      {canRespond && !terminal && (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-bold text-foreground">Răspunsul locației</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {RESPONSE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = response?.response_type === option.key;
              return (
                <button key={option.key} type="button" onClick={() => onRespond(lead.id, option.key)} disabled={responding} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition-colors disabled:opacity-60 ${selected ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-secondary"}`}>
                  {responding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Răspunsul nu distribuie automat telefonul și nu deschide unilateral chatul.</p>
        </div>
      )}

      {!terminal && (
        <ProviderLeadContactAccess
          leadId={lead.id}
          locationId={locationId}
          enabled={canAccessContact && lead.full_details?.phone_available_for_request === true}
          responseType={response?.response_type || ""}
        />
      )}

      <ProviderLeadChat
        leadId={lead.id}
        locationId={locationId}
        enabled={canChat && lead.access_tier === "pro_full"}
        responseType={response?.response_type || ""}
        terminal={terminal}
      />

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> {terminal ? "Contactul este retras, iar cererea este disponibilă numai în istoric." : "Telefonul rămâne separat. Chatul devine activ numai după deschiderea explicită de către client."}</span>
        {!terminal && lead.status === "new" && !response && (
          <button type="button" onClick={() => onMarkViewed(lead.id)} disabled={marking} className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-60">
            {marking ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}Marchează ca văzut
          </button>
        )}
      </div>
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

  const canRespond = entitlement?.plan_code === "pro" && entitlement?.feature_keys?.includes("provider_leads.respond");
  const canAccessContact = entitlement?.plan_code === "pro" && entitlement?.feature_keys?.includes("provider_contact.access_after_consent");
  const canChat = entitlement?.plan_code === "pro" && entitlement?.feature_keys?.includes("provider_chat.access");

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const selectedFilter = FILTERS.find((item) => item.key === filter) || FILTERS[0];
      const inboxResponse = await base44.functions.invoke("providerLeadInboxOps", {
        action: "list",
        location_id: locationId,
        scope: selectedFilter.scope,
        status: selectedFilter.status,
        limit: 100,
      });
      const inboxData = responseData(inboxResponse);
      setData(inboxData);
      const resolvedEntitlement = inboxData.entitlement || FREE_ENTITLEMENT;
      setEntitlement(resolvedEntitlement);

      if (resolvedEntitlement.plan_code === "pro" && resolvedEntitlement.feature_keys?.includes("provider_leads.respond")) {
        const responsesResponse = await base44.functions.invoke("providerLeadResponseOps", { action: "list", location_id: locationId });
        const responseRows = responseData(responsesResponse).responses || [];
        setResponsesByLead(Object.fromEntries(responseRows.map((row) => [row.lead_id, row])));
      } else {
        setResponsesByLead({});
      }
    } catch (loadError) {
      setError(loadError?.message || "Leadurile nu au putut fi încărcate.");
    } finally {
      setLoading(false);
    }
  }, [filter, locationId]);

  useEffect(() => { void load(); }, [load]);

  const leads = useMemo(() => data?.leads || [], [data?.leads]);

  useEffect(() => {
    if (!pendingTargetId || loading) return;
    const target = document.getElementById(`provider-lead-${pendingTargetId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setPendingTargetId("");
  }, [leads, loading, pendingTargetId]);

  const openNotificationTarget = useCallback((notification) => {
    if (!notification?.action_target_id) return;
    setFilter(TERMINAL_NOTIFICATION_EVENTS.has(notification.event_key) ? "history" : "all");
    setPendingTargetId(notification.action_target_id);
  }, []);

  const markViewed = async (leadId) => {
    setMarkingId(leadId);
    setError("");
    try {
      await base44.functions.invoke("providerLeadInboxOps", { action: "mark_viewed", location_id: locationId, lead_id: leadId }).then(responseData);
      await load();
    } catch (markError) {
      setError(markError?.message || "Leadul nu a putut fi actualizat.");
    } finally {
      setMarkingId("");
    }
  };

  const submitResponse = async (leadId, responseType) => {
    setRespondingId(leadId);
    setError("");
    try {
      await base44.functions.invoke("providerLeadResponseOps", { action: "submit", location_id: locationId, lead_id: leadId, response_type: responseType }).then(responseData);
      await load();
    } catch (responseError) {
      setError(responseError?.message || "Răspunsul nu a putut fi salvat.");
    } finally {
      setRespondingId("");
    }
  };

  const locationName = data?.location?.name || location?.public_display_name || location?.name || "Locația selectată";
  const historySelected = filter === "history";

  return (
    <section className="space-y-6">
      <header className="rounded-[22px] border border-foreground/10 bg-card p-6 shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Inbox className="h-4 w-4" /> Inbox furnizor</div>
            <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">Leaduri</h1><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${entitlement?.plan_code === "pro" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}>Plan {entitlement?.plan_code === "pro" ? "Pro" : "Free"}</span></div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Cereri relevante pentru {locationName}. Cererile active și cele încheiate sunt păstrate separat.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProviderNotificationCenter locationId={locationId} onOpenTarget={openNotificationTarget} />
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizează</button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Leaduri noi</p><p className="mt-1 text-2xl font-extrabold text-foreground">{data?.counters?.new || 0}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Active</p><p className="mt-1 text-2xl font-extrabold text-foreground">{data?.counters?.active || 0}</p></div>
        <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">În istoric</p><p className="mt-1 text-2xl font-extrabold text-foreground">{data?.counters?.history || 0}</p></div>
      </div>

      <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground"><div className="flex items-start gap-3"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p><strong>Acces controlat.</strong> Free vede rezumatul anonim. Pro primește detaliile și chatul numai în Top 3. După încheiere, datele private și acțiunile sunt retrase.</p></div></div>

      <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${filter === item.key ? "bg-foreground text-background" : "border border-border bg-card text-foreground hover:bg-secondary"}`}>{item.label}</button>)}</div>
      {error && <p role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}

      {loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă leadurile...</div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><Inbox className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-heading text-lg font-extrabold text-foreground">{historySelected ? "Nu există cereri încheiate" : "Nu există leaduri în această categorie"}</h2><p className="mt-2 text-sm text-muted-foreground">{historySelected ? "Cererile rezolvate, închise sau expirate vor apărea aici." : "Leadurile eligibile vor apărea aici după acordul clientului."}</p></div>
      ) : (
        <div className="space-y-4">{leads.map((lead) => <LeadCard key={lead.id} lead={lead} response={responsesByLead[lead.id] || null} locationId={locationId} canRespond={canRespond} canAccessContact={canAccessContact} canChat={canChat} onMarkViewed={markViewed} onRespond={submitResponse} marking={markingId === lead.id} responding={respondingId === lead.id} />)}</div>
      )}

      <div className="rounded-2xl border border-border bg-secondary/35 p-5"><div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><h2 className="text-sm font-bold text-foreground">{canChat ? "Chatul controlat este activ" : "Răspunsurile și chatul sunt disponibile în planul Pro"}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Mesajele active rămân în VIASEE și nu pot conține telefon, email sau linkuri. Pentru cererile încheiate, conversațiile existente sunt doar pentru consultare.</p></div></div></div>
    </section>
  );
}
