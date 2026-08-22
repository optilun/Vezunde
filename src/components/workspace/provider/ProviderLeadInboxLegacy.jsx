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

  // Coloana din stanga, in tiparul unei aplicatii de mesagerie (2026-08-22): un panou unic
  // cu filtrele sus, ca bara de segmente, si conversatiile dedesubt, despartite prin linii
  // subtiri - nu carduri separate, plutind fiecare pe fundal.
  const listColumn = (
    <div className="overflow-hidden rounded-[1.4rem] border border-[#e3ddd0] bg-[#fdfbf6]">
      <div className="flex gap-1.5 overflow-x-auto border-b border-[#e3ddd0] px-2.5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 font-heading text-[11.5px] font-bold tracking-[-0.015em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#fdfbf6] ${filter === item.key ? "bg-[#171717] text-white" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă cererile</div>
      ) : leads.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#e3ddd0] bg-white/70">
            <Inbox aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
          </span>
          <h2 className="mt-4 font-heading text-[15px] font-extrabold leading-snug tracking-[-0.025em]">{historySelected ? "Nu există cereri încheiate" : "Nicio conversație aici"}</h2>
          <p className="mx-auto mt-2 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">{historySelected ? "Cererile rezolvate, închise sau expirate apar aici." : "Cererile eligibile apar aici după acordul clientului."}</p>
        </div>
      ) : (
        <div className="divide-y divide-[#e3ddd0] p-1.5">
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
    <div className="flex min-h-72 flex-col justify-center rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] px-8 py-10">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">Nicio cerere selectată</p>
      <h2 className="mt-3 max-w-md font-heading text-[2rem] font-extrabold leading-[1.02] tracking-[-0.045em]">Alege o cerere din listă.</h2>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">Detaliile clientului, răspunsul locației și conversația apar aici.</p>
    </div>
  );

  return (
    <section className="space-y-5">
      {/* Antet editorial (2026-08-19): acelasi registru ca homepage - eyebrow mono, titlu mare
          strans, banda subtire cu jaloane si contoare in placi tonale din paleta de categorii.
          Valorile contoarelor vin neschimbate din providerLeadInboxOps. */}
      <header>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75 sm:text-[11px]">
              Cereri primite · {locationName}
            </p>
            {/* Antet compact (2026-08-22): titlul editorial ocupa mai putin pe verticala,
                ca lista de conversatii sa fie ce vezi primul, ca intr-o aplicatie de
                mesagerie. Registrul tipografic ramane cel din design system. */}
            <h1 className="mt-3 max-w-3xl font-heading text-[1.75rem] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[2.1rem]">
              Cererile clienților tăi.
            </h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              Cererile active și cele încheiate sunt păstrate separat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`rounded-full px-3.5 py-1.5 font-heading text-[12px] font-bold tracking-[-0.015em] ${entitlement?.plan_code === "pro" ? "bg-[#171717] text-white" : "border border-foreground/15 bg-white/70 text-foreground"}`}>Plan {entitlement?.plan_code === "pro" ? "Pro" : "Free"}</span>
            <ProviderNotificationCenter locationId={locationId} onOpenTarget={openNotificationTarget} />
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizează</button>
          </div>
        </div>

        {/* Contoarele, stranse intr-o singura banda in loc de trei placi mari: aceleasi
            valori, venite neschimbat din providerLeadInboxOps, dar fara sa impinga lista
            de conversatii sub linia de plutire. */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-[#e3ddd0] overflow-hidden rounded-[1.2rem] border border-[#e3ddd0] bg-[#fdfbf6]">
          {[
            { value: data?.counters?.new || 0, label: "Noi", dot: "#8d9c6f" },
            { value: data?.counters?.active || 0, label: "În lucru", dot: "#7e9aa8" },
            { value: data?.counters?.history || 0, label: "Istoric", dot: "#bda06a" },
          ].map((item) => (
            <div key={item.label} className="px-4 py-3">
              <p className="font-heading text-[1.5rem] font-extrabold leading-none tracking-[-0.04em] text-[#1c1c1c]">{item.value}</p>
              <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-black/55">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.dot }} />
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="flex items-start gap-2.5 border-y border-border py-4 text-sm leading-relaxed text-muted-foreground">
        <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
        <p><strong className="font-heading font-bold text-foreground">Acces controlat.</strong> Free vede rezumatul anonim. Pro primește detaliile și chatul numai în Top 3. După încheiere, datele private și acțiunile sunt retrase.</p>
      </div>

      {error && <p role="alert" className="rounded-[1.4rem] border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}

      {/* Pe telefon lista si detaliul nu incap alaturi, deci lista e "acasa" si intri in
          cerere, cu buton de intoarcere - acelasi tipar ca in spatiul cererii pacientului. */}
      <div className="lg:hidden">
        {selectedLead ? (
          <div className="space-y-3">
            <button type="button" onClick={() => setSelectedLeadId("")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45">
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