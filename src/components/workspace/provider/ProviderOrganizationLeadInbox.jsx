import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderNotificationCenter from "@/components/notifications/ProviderNotificationCenter";
import useChatLivePolling from "@/components/chat/useChatLivePolling";
import { locationPlanLabel, organizationInboxDataFor, organizationLeadTarget } from "@/lib/providerOrganizationInboxView";
import { withTransientRetry } from "@/lib/transientRetry";
import { INBOX_RETRY_OPTIONS, inboxErrorMessage } from "@/lib/providerInboxErrors";
import LeadListItem from "./leads/LeadListItem";
import InboxFilters from "./leads/InboxFilters";
import InboxPagination from "./leads/InboxPagination";
import InboxEmptyState from "./leads/InboxEmptyState";
import "@/styles/provider-lead-inbox.css";

export default function ProviderOrganizationLeadInbox({ organizationId, onOpenLead }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("active");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const queryKey = JSON.stringify([organizationId, filter, location, status, query, offset]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setOffset(0); }, 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!organizationId) return;
    const ticket = ++sequence.current;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const response = await withTransientRetry(() => base44.functions.invoke("providerOrganizationLeadInboxOps", {
        action: "list", inbox_mode: true, organization_id: organizationId,
        scope: filter === "history" ? "history" : "active", unread_only: filter === "unread",
        status: filter === "history" ? "" : status, search: query, location_id: location || undefined, offset, limit: 50,
      }), INBOX_RETRY_OPTIONS);
      const next = response?.data || {};
      if (next.error) throw new Error(next.error);
      if (ticket === sequence.current) { setData({ ...next, _query_key: queryKey }); setError(""); }
    } catch (cause) { if (ticket === sequence.current) { setData(null); setError(inboxErrorMessage(cause)); } }
    finally { if (ticket === sequence.current) setLoading(false); }
  }, [organizationId, filter, location, status, query, offset, queryKey]);
  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load]);
  useEffect(() => { setLocation(""); setOffset(0); setData(null); }, [organizationId]);
  const current = organizationInboxDataFor(data, organizationId, queryKey);
  const locations = organizationInboxDataFor(data, organizationId)?.locations || [];
  const leads = current?.leads || [];
  useChatLivePolling({ active: Boolean(current), busy: loading, intervalMs: 20000, onPoll: () => load({ silent: true }) });
  return <section className="provider-inbox">
    <header className="inbox-heading"><div><h1>Cereri</h1><p>Toate locațiile · {current?.pagination?.total || 0} rezultate · {current?.unread_conversations || 0} conversații necitite</p></div><div className="inbox-tools"><ProviderNotificationCenter locationId="" locations={locations} onOpenTarget={notification => onOpenLead?.({ leadId: notification.action_target_id, locationId: notification.location_id, history: /resolved|closed|expired/.test(notification.event_key) })} /><button type="button" className="inbox-button" aria-label="Actualizează cererile" disabled={loading} onClick={() => void load()}><RefreshCw /><span className="inbox-refresh-label">Actualizează</span></button></div></header>
    {error && <p className="inbox-error" role="alert">{error}</p>}
    <div className="inbox-organization">
      <InboxFilters filter={filter} status={status} search={search} onChange={value => { setFilter(value); setOffset(0); }} onSearch={setSearch} onStatus={value => { setStatus(value); setOffset(0); }} />
      <div className="px-4 py-2 border-b border-border"><label className="flex gap-2 items-center text-xs">Locație<select className="inbox-filter-select max-w-xs" value={location} onChange={event => { setLocation(event.target.value); setOffset(0); }}><option value="">Toate locațiile</option>{locations.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div>
      <div className="inbox-rows" aria-busy={loading}>{!current && loading ? <div className="inbox-empty" role="status">Se încarcă cererile…</div> : leads.length ? leads.map(lead => <LeadListItem key={lead.id} lead={lead} locationName={lead.location_name} planLabel={locationPlanLabel(current.entitlements_by_location, lead.location_id)} onSelect={() => { const next = organizationLeadTarget(lead); if (next) onOpenLead?.(next); }} />) : <InboxEmptyState filter={filter} search={query} status={status} />}</div>
      <InboxPagination page={current?.pagination} count={leads.length} busy={loading} onPage={setOffset} />
    </div>
  </section>;
}
