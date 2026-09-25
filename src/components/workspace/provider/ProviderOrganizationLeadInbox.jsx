import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderNotificationCenter from "@/components/notifications/ProviderNotificationCenter";
import { groupOrganizationLeads, locationPlanLabel, organizationInboxDataFor, organizationLeadTarget } from "@/lib/providerOrganizationInboxView";
import LeadListItem from "./leads/LeadListItem";

const PAGE_SIZE = 50;
const TERMINAL_NOTIFICATION_EVENTS = new Set([
  "provider_request_resolved",
  "provider_request_closed",
  "provider_request_expired",
]);
const FILTERS = [
  { key: "all", label: "Active", scope: "active", status: "" },
  { key: "new", label: "Noi", scope: "active", status: "new" },
  { key: "viewed", label: "Văzute", scope: "active", status: "viewed" },
  { key: "interested", label: "Putem ajuta", scope: "active", status: "interested" },
  { key: "needs_details", label: "Detalii necesare", scope: "active", status: "needs_details" },
  { key: "declined", label: "Nu putem ajuta", scope: "active", status: "declined" },
  { key: "history", label: "Încheiate", scope: "history", status: "" },
];

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderOrganizationLeadInbox({ organizationId, onOpenLead }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const queryKey = JSON.stringify([organizationId, filter, locationFilter, offset]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const selected = FILTERS.find((item) => item.key === filter) || FILTERS[0];
      const inboxData = responseData(await base44.functions.invoke("providerOrganizationLeadInboxOps", {
        action: "list",
        organization_id: organizationId,
        scope: selected.scope,
        status: selected.status,
        location_id: locationFilter || undefined,
        offset,
        limit: PAGE_SIZE,
      }));
      if (requestId === requestRef.current) setData({ ...inboxData, _query_key: queryKey });
    } catch (loadError) {
      if (requestId === requestRef.current) {
        setData(null);
        setError(loadError?.response?.data?.error || loadError?.message || "Cererile nu au putut fi încărcate.");
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [filter, locationFilter, offset, organizationId, queryKey]);

  useEffect(() => {
    void load();
    return () => { requestRef.current += 1; };
  }, [load]);

  useEffect(() => {
    setLocationFilter("");
    setOffset(0);
    setData(null);
  }, [organizationId]);

  const currentData = organizationInboxDataFor(data, organizationId, queryKey);
  const busy = loading || Boolean(data && !currentData);
  const groups = useMemo(() => groupOrganizationLeads(currentData?.leads), [currentData?.leads]);
  // Keep authorized locations stable across filters to avoid reloading every notification feed.
  const locations = organizationInboxDataFor(data, organizationId)?.locations || [];
  const totalLeads = currentData?.counters?.lead_deliveries_in_scope ?? 0;
  const totalRequests = currentData?.counters?.distinct_requests_in_scope ?? 0;
  const page = currentData?.pagination || {};
  const pageStart = totalLeads > 0 ? (page.offset ?? offset) + 1 : 0;
  const pageEnd = Math.min((page.offset ?? offset) + (currentData?.leads?.length || 0), totalLeads);
  const historySelected = filter === "history";

  const openNotificationTarget = useCallback((notification) => {
    if (!notification?.action_target_id || !notification?.location_id) return;
    onOpenLead?.({
      leadId: notification.action_target_id,
      locationId: notification.location_id,
      history: TERMINAL_NOTIFICATION_EVENTS.has(notification.event_key),
    });
  }, [onOpenLead]);

  return (
    <section className="space-y-5">
      <header>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/75 sm:text-[11px]">
              Cereri primite · toate locațiile
            </p>
            <h1 className="mt-4 max-w-3xl font-heading text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.055em] sm:text-[3.4rem]">
              Cererile din rețeaua ta.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Fiecare locație primește și gestionează propriul lead. Deschide un rând pentru răspuns, telefon sau conversație în locația respectivă.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <ProviderNotificationCenter locations={locations} onOpenTarget={openNotificationTarget} />
            <button type="button" onClick={() => void load()} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45 disabled:opacity-60">
              <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} /> Actualizează
            </button>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.4rem] border border-[#ccd2ba] bg-[#dfe3d2] px-5 py-4">
            <p className="font-heading text-[2.4rem] font-extrabold leading-none tracking-[-0.05em]">{totalLeads}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/55">Leaduri livrate · filtrul curent</p>
          </div>
          <div className="rounded-[1.4rem] border border-[#c6d3da] bg-[#dce5e9] px-5 py-4">
            <p className="font-heading text-[2.4rem] font-extrabold leading-none tracking-[-0.05em]">{totalRequests}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/55">Cereri distincte · filtrul curent</p>
          </div>
        </div>
      </header>

      <div className="flex items-start gap-2.5 border-y border-border py-4 text-sm leading-relaxed text-muted-foreground">
        <LockKeyhole aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
        <p><strong className="font-heading font-bold text-foreground">Acces per locație.</strong> Planul Pro al unei locații nu schimbă ce poate vedea alta. Detaliile clientului și acțiunile se deschid numai în inboxul locației autorizate.</p>
      </div>

      <div className="overflow-hidden rounded-[1.4rem] border border-[#e3ddd0] bg-[#fdfbf6]">
        <div className="flex flex-col gap-3 border-b border-[#e3ddd0] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 font-heading text-[12px] font-bold">
            Locație
            <select
              value={locationFilter}
              onChange={(event) => { setLocationFilter(event.target.value); setOffset(0); }}
              className="min-h-10 max-w-[16rem] rounded-full border border-foreground/20 bg-white px-3 text-[12px] text-foreground"
              disabled={busy && locations.length === 0}
            >
              <option value="">Toate locațiile</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </label>
          <p className="text-[12px] text-muted-foreground">Gruparea aceleiași cereri este doar vizuală.</p>
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-b border-[#e3ddd0] px-2.5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setFilter(item.key); setOffset(0); }}
              className={"shrink-0 rounded-full px-3 py-1.5 font-heading text-[11.5px] font-bold tracking-[-0.015em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#fdfbf6] " + (filter === item.key ? "bg-[#171717] text-white" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground")}
            >
              {item.label}
            </button>
          ))}
        </div>
        {busy ? (
          <div className="flex min-h-40 items-center justify-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă cererile</div>
        ) : error ? (
          <div role="alert" className="px-6 py-10 text-center text-sm text-destructive">{error}</div>
        ) : groups.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Inbox className="mx-auto h-5 w-5 text-muted-foreground" />
            <h2 className="mt-3 font-heading text-xl font-extrabold">Nicio cerere în această categorie</h2>
            <p className="mt-2 text-sm text-muted-foreground">{historySelected ? "Cererile încheiate vor apărea aici." : "Cererile eligibile vor apărea aici după acordul clientului."}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#e3ddd0] p-1.5">
            {groups.map((group) => (
              <div key={group.key} className="py-1">
                {group.leads.length > 1 && (
                  <p className="px-3 pb-1 pt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
                    Aceeași cerere · {group.leads.length} locații pe această pagină
                  </p>
                )}
                {group.leads.map((lead) => (
                  <LeadListItem
                    key={lead.id}
                    lead={lead}
                    locationName={lead.location_name || locations.find((location) => location.id === lead.location_id)?.name || "Locație"}
                    planLabel={locationPlanLabel(currentData?.entitlements_by_location, lead.location_id)}
                    onSelect={() => {
                      const target = organizationLeadTarget(lead);
                      if (target) onOpenLead?.(target);
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        {!busy && !error && totalLeads > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3ddd0] px-4 py-3">
            <p className="text-[12px] text-muted-foreground">Leadurile {pageStart}–{pageEnd} din {totalLeads}</p>
            <div className="flex gap-2">
              <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="min-h-10 rounded-full border border-foreground/20 px-3 font-heading text-[12px] font-bold disabled:opacity-40">Înapoi</button>
              <button type="button" disabled={!page.has_more} onClick={() => setOffset(offset + PAGE_SIZE)} className="min-h-10 rounded-full border border-foreground/20 px-3 font-heading text-[12px] font-bold disabled:opacity-40">Înainte</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
