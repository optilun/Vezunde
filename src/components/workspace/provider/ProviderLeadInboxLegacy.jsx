// Inboxul de leaduri al locatiei, pe doua coloane (2026-08-18): lista de cereri in stanga,
// cererea selectata cu raspuns, telefon si conversatie in dreapta. Inainte fiecare lead era
// un card lung, iar chatul o cutie mica ingropata in josul lui - greu de urmarit cu mai
// multe cereri active. Apelurile backend (providerLeadInboxOps, providerLeadResponseOps) si
// regulile de acces rămân identice: s-a schimbat doar prezentarea.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Inbox, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderNotificationCenter from "@/components/notifications/ProviderNotificationCenter";
import LeadListItem from "./leads/LeadListItem";
import LeadDetailPanel from "./leads/LeadDetailPanel";

const FILTERS = [
  { key: "all", label: "Active", scope: "active", status: "" },
  { key: "new", label: "Noi", scope: "active", status: "new" },
  { key: "viewed", label: "Văzute", scope: "active", status: "viewed" },
  { key: "interested", label: "Putem ajuta", scope: "active", status: "interested" },
  { key: "needs_details", label: "Detalii necesare", scope: "active", status: "needs_details" },
  { key: "declined", label: "Nu putem ajuta", scope: "active", status: "declined" },
  { key: "history", label: "Încheiate", scope: "history", status: "" },
];

const TERMINAL_NOTIFICATION_EVENTS = new Set([
  "provider_request_resolved",
  "provider_request_closed",
  "provider_request_expired",
]);

const FREE_ENTITLEMENT = { plan_code: "free", status: "free", feature_keys: [] };

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { status: response?.status || 0 });
  return data;
}

export default function ProviderLeadInbox({ locationId, location }) {
  const [data, setData] = useState(null);
  const [entitlement, setEntitlement] = useState(FREE_ENTITLEMENT);
  const [responsesByLead, setResponsesByLead] = useState({});
  const [filter, setFilter] = useState("all");
  const [selectedLeadId, setSelectedLeadId] = useState("");
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
      const inboxData = responseData(await base44.functions.invoke("providerLeadInboxOps", {
        action: "list",
        location_id: locationId,
        scope: selectedFilter.scope,
        status: selectedFilter.status,
        limit: 100,
      }));
      setData(inboxData);
      const resolvedEntitlement = inboxData.entitlement || FREE_ENTITLEMENT;
      setEntitlement(resolvedEntitlement);

      if (resolvedEntitlement.plan_code === "pro" && resolvedEntitlement.feature_keys?.includes("provider_leads.respond")) {
        const responseRows = responseData(await base44.functions.invoke("providerLeadResponseOps", { action: "list", location_id: locationId })).responses || [];
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

  // Pe desktop lista si detaliul stau alaturi, deci prima cerere se deschide singura;
  // daca selectia nu mai exista in filtrul curent, revenim la prima din lista.
  useEffect(() => {
    if (leads.length === 0) {
      if (selectedLeadId) setSelectedLeadId("");
      return;
    }
    if (leads.some((lead) => lead.id === selectedLeadId)) return;
    // Pe telefon NU deschidem automat prima cerere: acolo lista e ecranul de start, iar o
    // selectie automata ar sari peste ea. Selectia stalea se curata insa pe ambele.
    const wide = typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)")?.matches;
    setSelectedLeadId(wide ? leads[0].id : "");
  }, [leads, selectedLeadId]);

  const openNotificationTarget = useCallback((notification) => {
    if (!notification?.action_target_id) return;
    setFilter(TERMINAL_NOTIFICATION_EVENTS.has(notification.event_key) ? "history" : "all");
    setSelectedLeadId(notification.action_target_id);
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
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) || null;

  const listColumn = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${filter === item.key ? "bg-foreground text-background" : "border border-border bg-card text-foreground hover:bg-secondary"}`}>{item.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-border bg-card text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă leadurile...</div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <Inbox className="mx-auto h-7 w-7 text-muted-foreground" />
          <h2 className="mt-3 font-heading text-sm font-extrabold text-foreground">{historySelected ? "Nu există cereri încheiate" : "Nu există leaduri în această categorie"}</h2>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{historySelected ? "Cererile rezolvate, închise sau expirate vor apărea aici." : "Leadurile eligibile vor apărea aici după acordul clientului."}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <LeadListItem
              key={lead.id}
              lead={lead}
              response={responsesByLead[lead.id] || null}
              selected={lead.id === selectedLeadId}
              onSelect={() => setSelectedLeadId(lead.id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  const detailColumn = selectedLead ? (
    <LeadDetailPanel
      lead={selectedLead}
      response={responsesByLead[selectedLead.id] || null}
      locationId={locationId}
      canRespond={canRespond}
      canAccessContact={canAccessContact}
      canChat={canChat}
      onMarkViewed={markViewed}
      onRespond={submitResponse}
      marking={markingId === selectedLead.id}
      responding={respondingId === selectedLead.id}
    />
  ) : (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <Inbox className="h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-bold text-foreground">Selectează o cerere</p>
      <p className="mt-1 text-xs text-muted-foreground">Detaliile, răspunsul și conversația apar aici.</p>
    </div>
  );

  return (
    <section className="space-y-5">
      <header className="rounded-[22px] border border-foreground/10 bg-card p-6 shadow-[0_14px_40px_rgba(23,23,23,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Inbox className="h-4 w-4" /> Inbox furnizor</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground">Leaduri</h1>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${entitlement?.plan_code === "pro" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}>Plan {entitlement?.plan_code === "pro" ? "Pro" : "Free"}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Cereri relevante pentru {locationName}. Cererile active și cele încheiate sunt păstrate separat.</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{data?.counters?.new || 0}</strong> noi</span>
              <span><strong className="text-foreground">{data?.counters?.active || 0}</strong> active</span>
              <span><strong className="text-foreground">{data?.counters?.history || 0}</strong> în istoric</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProviderNotificationCenter locationId={locationId} onOpenTarget={openNotificationTarget} />
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizează</button>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs text-foreground">
        <div className="flex items-start gap-2.5">
          <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p><strong>Acces controlat.</strong> Free vede rezumatul anonim. Pro primește detaliile și chatul numai în Top 3. După încheiere, datele private și acțiunile sunt retrase.</p>
        </div>
      </div>

      {error && <p role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}

      {/* Pe telefon lista si detaliul nu incap alaturi, deci lista e "acasa" si intri in
          cerere, cu buton de intoarcere - acelasi tipar ca in spatiul cererii pacientului. */}
      <div className="lg:hidden">
        {selectedLead ? (
          <div className="space-y-3">
            <button type="button" onClick={() => setSelectedLeadId("")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-secondary">
              <ArrowLeft className="h-3.5 w-3.5" /> Toate cererile
            </button>
            {detailColumn}
          </div>
        ) : listColumn}
      </div>

      <div className="hidden gap-5 lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <aside className="min-w-0">{listColumn}</aside>
        <main className="min-w-0">{detailColumn}</main>
      </div>
    </section>
  );
}