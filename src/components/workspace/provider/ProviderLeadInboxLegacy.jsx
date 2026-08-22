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
import ProviderUpgradeCard from "./leads/ProviderUpgradeCard";

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
  // Blocul de upgrade apare numai cat timp locatia nu are inca plan Pro activ.
  const showUpgradeCard = entitlement?.plan_code !== "pro";
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
          <span
            aria-hidden="true"
            style={{ borderColor: historySelected ? "#dac69b" : "#ccd2ba", backgroundColor: historySelected ? "#eadcba" : "#dfe3d2" }}
            className="relative mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border"
          >
            <span className="absolute inset-0 opacity-30 mix-blend-multiply" style={{ backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" }} />
            <Inbox className="relative z-10 h-5 w-5 text-black/55" />
          </span>
          <p className="mt-4 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">Nicio cerere</p>
          <h2 className="mt-2 font-heading text-xl font-extrabold leading-[1.08] tracking-[-0.035em]">{historySelected ? "Nu există cereri încheiate" : "Nu există cereri în această categorie"}</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{historySelected ? "Cererile rezolvate, închise sau expirate apar aici." : "Cererile eligibile apar aici după acordul clientului."}</p>
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
    // Cat timp nu e nimic selectat, coloana din dreapta era o cutie goala mare. Acolo intra
    // acum blocul de upgrade, in format lat - se vede fara sa derulezi, spre deosebire de
    // pozitia lui de sub lista.
    <div className="space-y-5">
      {showUpgradeCard && <ProviderUpgradeCard variant="wide" />}
      {/* Cand blocul de upgrade este vizibil, nota asta trece pe planul doi: altfel doua
          titluri mari se bat cap in cap in aceeasi coloana. */}
      <div className={`flex flex-col justify-center rounded-[1.75rem] border border-[#e3ddd0] bg-[#fdfbf6] ${showUpgradeCard ? "px-8 py-7" : "min-h-72 px-8 py-10"}`}>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75">Nicio cerere selectată</p>
        <h2 className={`mt-3 max-w-md font-heading font-extrabold leading-[1.02] tracking-[-0.045em] ${showUpgradeCard ? "text-[1.3rem]" : "text-[2rem]"}`}>Alege o cerere din listă.</h2>
        <p className={`mt-3 max-w-md leading-relaxed text-muted-foreground ${showUpgradeCard ? "text-sm" : "text-base"}`}>Detaliile clientului, răspunsul locației și conversația apar aici.</p>
      </div>
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
            <h1 className="mt-4 max-w-3xl font-heading text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-[3.4rem]">
              <span className="block">Cererile clienților tăi.</span>
              <span className="block">Într-un singur loc.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Cererile active și cele încheiate sunt păstrate separat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`rounded-full px-3.5 py-1.5 font-heading text-[12px] font-bold tracking-[-0.015em] ${entitlement?.plan_code === "pro" ? "bg-[#171717] text-white" : "border border-foreground/15 bg-white/70 text-foreground"}`}>Plan {entitlement?.plan_code === "pro" ? "Pro" : "Free"}</span>
            <ProviderNotificationCenter locationId={locationId} onOpenTarget={openNotificationTarget} />
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizează</button>
          </div>
        </div>

        <div className="relative mt-9 h-px bg-[#9a8668]/45">
          {[16, 50, 84].map((position) => (
            <span key={position} aria-hidden="true" className="absolute -top-1 h-[9px] w-[9px] -translate-x-1/2 rounded-full border border-[#8d7658] bg-[#f8f4ec]" style={{ left: `${position}%` }} />
          ))}
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            { value: data?.counters?.new || 0, label: "Cereri noi", border: "#ccd2ba", bg: "#dfe3d2" },
            { value: data?.counters?.active || 0, label: "În lucru", border: "#c6d3da", bg: "#dce5e9" },
            { value: data?.counters?.history || 0, label: "În istoric", border: "#dac69b", bg: "#eadcba" },
          ].map((item) => (
            <div key={item.label} style={{ borderColor: item.border, backgroundColor: item.bg }} className="relative overflow-hidden rounded-[1.4rem] border px-5 py-4 shadow-[0_10px_30px_rgba(34,30,24,0.028)]">
              <span aria-hidden="true" className="absolute inset-0 opacity-30 mix-blend-multiply" style={{ backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" }} />
              <p className="relative z-10 font-heading text-[2.4rem] font-extrabold leading-none tracking-[-0.05em] text-[#1c1c1c]">{item.value}</p>
              <p className="relative z-10 mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/55">{item.label}</p>
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
        ) : (
          <div className="space-y-4">
            {listColumn}
            {showUpgradeCard && <ProviderUpgradeCard />}
          </div>
        )}
      </div>

      {/* Pe desktop lista ramane in stanga, iar blocul de upgrade traieste in coloana din
          dreapta (vezi detailColumn), unde se vede imediat. */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <aside className="min-w-0">{listColumn}</aside>
        <main className="min-w-0">{detailColumn}</main>
      </div>
    </section>
  );
}