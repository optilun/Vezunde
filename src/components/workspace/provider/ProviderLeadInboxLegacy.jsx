import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProviderNotificationCenter from "@/components/notifications/ProviderNotificationCenter";
import useChatLivePolling from "@/components/chat/useChatLivePolling";
import LeadListItem from "./leads/LeadListItem";
import LeadDetailPanel from "./leads/LeadDetailPanel";
import LeadConversationPanel from "./leads/LeadConversationPanel";
import InboxFilters from "./leads/InboxFilters";
import InboxPagination from "./leads/InboxPagination";
import { mergeFocusedLead } from "@/lib/providerOrganizationInboxView";
import { withTransientRetry } from "@/lib/transientRetry";
import { INBOX_RETRY_OPTIONS, inboxErrorMessage } from "@/lib/providerInboxErrors";
import "@/styles/provider-lead-inbox.css";

const TERMINAL_EVENTS = new Set(["provider_request_resolved", "provider_request_closed", "provider_request_expired"]);
function result(response) {
  const data = response?.data || {};
  if (data.error) throw Object.assign(new Error(data.error), { status: response?.status || 0 });
  return data;
}
function useMedia(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.(query).matches));
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}
export default function ProviderLeadInbox({ locationId, location, targetLeadId = "", targetHistory = false, onOpenRequestSettings }) {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(targetHistory ? "history" : "active");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [responding, setResponding] = useState(false);
  const [marking, setMarking] = useState(false);
  const [tick, setTick] = useState(0);
  const target = useRef(targetLeadId);
  const sequence = useRef(0);
  const detailSequence = useRef(0);
  const drawerRef = useRef(null);
  const shellRef = useRef(null);
  const wide = useMedia("(min-width: 1024px)");
  const threeColumns = useMedia("(min-width: 1450px)");
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell?.getBoundingClientRect || typeof document === "undefined") return;
    const fit = () => {
      const nav = document.querySelector('[aria-label="Navigare rapidă"]');
      const navHeight = nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().height : 0;
      const viewport = window.visualViewport;
      const height = Math.max(300, (viewport?.height || window.innerHeight) - shell.getBoundingClientRect().top + (viewport?.offsetTop || 0) - navHeight - 12);
      shell.style.setProperty("--inbox-height", height + "px");
    };
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(shell.parentElement);
    return () => { window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); observer?.disconnect(); };
  }, [selectedId, wide, threeColumns, error]);
  useEffect(() => {
    if (!detailsOpen || threeColumns) return;
    const previous = document.activeElement;
    const drawer = drawerRef.current;
    drawer?.querySelector("button")?.focus();
    const keydown = event => {
      if (event.key === "Escape") { event.preventDefault(); setDetailsOpen(false); }
      if (event.key !== "Tab" || !drawer) return;
      const items = Array.from(drawer.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]'));
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); if (last instanceof HTMLElement) last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); if (first instanceof HTMLElement) first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, [detailsOpen, threeColumns]);
  const queryKey = JSON.stringify([locationId, filter, status, query, offset]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setOffset(0); }, 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async ({ silent = false } = {}) => {
    if (!locationId) return;
    const ticket = ++sequence.current;
    if (!silent) { setLoading(true); setError(""); }
    try {
      const next = result(await withTransientRetry(() => base44.functions.invoke("providerLeadInboxOps", {
        action: "list", inbox_mode: true, location_id: locationId,
        scope: filter === "history" ? "history" : "active",
        unread_only: filter === "unread", status: filter === "history" ? "" : status,
        search: query, lead_id: target.current || undefined, offset, limit: 50,
      }), INBOX_RETRY_OPTIONS));
      if (ticket === sequence.current) { setData({ ...next, queryKey }); setError(""); }
    } catch (cause) {
      if (ticket === sequence.current) { setData(null); setError(inboxErrorMessage(cause)); }
    } finally { if (ticket === sequence.current) setLoading(false); }
  }, [locationId, filter, status, query, offset, queryKey]);
  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load, tick]);
  const current = data?.queryKey === queryKey ? data : null;
  const leads = useMemo(() => mergeFocusedLead(current?.leads, current?.target_lead), [current]);
  const listedLeads = current?.leads || [];
  useEffect(() => {
    if (loading || !current) return;
    if (target.current) {
      const found = leads.find(row => row.id === target.current);
      setSelectedId(found?.id || "");
      return;
    }
    if (leads.some(row => row.id === selectedId)) return;
    setSelectedId(wide ? leads[0]?.id || "" : "");
  }, [leads, current, loading, selectedId, wide]);
  const selected = leads.find(row => row.id === selectedId);
  const detailKey = JSON.stringify([locationId, selectedId]);
  const loadDetail = useCallback(async () => {
    const ticket = ++detailSequence.current;
    if (!selectedId) { setDetail(null); setDetailLoading(false); return; }
    setDetailLoading(true);
    setDetail(null);
    try {
      const next = result(await withTransientRetry(() => base44.functions.invoke("providerLeadInboxOps", {
        action: "detail", location_id: locationId, lead_id: selectedId,
      }), INBOX_RETRY_OPTIONS));
      if (ticket === detailSequence.current) setDetail({ ...next, detailKey });
    } catch (cause) {
      if (ticket === detailSequence.current) setError(inboxErrorMessage(cause));
    } finally { if (ticket === detailSequence.current) setDetailLoading(false); }
  }, [locationId, selectedId, detailKey]);
  useEffect(() => { setDetailsOpen(false); void loadDetail(); return () => { detailSequence.current += 1; }; }, [loadDetail]);
  const currentDetail = detail?.detailKey === detailKey ? detail : null;
  const entitlement = current?.entitlement;
  const fullLead = selected && currentDetail?.lead ? { ...selected, ...currentDetail.lead, access_tier: selected.access_tier, provider_response: selected.provider_response } : selected;
  const chatChanged = useCallback(() => { void load({ silent: true }); }, [load]);
  useChatLivePolling({ active: Boolean(current) && !responding, busy: loading, intervalMs: 20000, onPoll: () => load({ silent: true }) });
  const resetSelection = () => { target.current = ""; setSelectedId(""); setDetailsOpen(false); };
  const select = row => { target.current = row.id; setSelectedId(row.id); setDetailsOpen(false); };
  const openNotification = notification => {
    if (!notification?.action_target_id) return;
    target.current = notification.action_target_id;
    setFilter(TERMINAL_EVENTS.has(notification.event_key) ? "history" : "active");
    setStatus(""); setSearch(""); setQuery(""); setOffset(0);
    setSelectedId(notification.action_target_id); setTick(value => value + 1);
  };
  const act = async (leadId, responseType) => {
    const setBusy = responseType ? setResponding : setMarking;
    setBusy(true); setError("");
    try {
      result(await base44.functions.invoke(responseType ? "providerLeadResponseOps" : "providerLeadInboxOps", {
        action: responseType ? "submit" : "mark_viewed", location_id: locationId, lead_id: leadId,
        ...(responseType ? { response_type: responseType } : {}),
      }));
      await load(); await loadDetail();
    } catch (cause) { setError(inboxErrorMessage(cause)); }
    finally { setBusy(false); }
  };
  const showDetails = Boolean(fullLead) && (threeColumns || detailsOpen);
  const details = showDetails && <aside ref={drawerRef} className="inbox-details" role={threeColumns ? "complementary" : "dialog"} aria-modal={threeColumns ? undefined : true} aria-label="Detaliile cererii">
    <div className="inbox-detail-heading"><span>Detaliile cererii</span><button type="button" className="inbox-button inbox-close-details" aria-label="Închide detaliile" onClick={() => setDetailsOpen(false)}><X /></button></div>
    {currentDetail?.lead ? <LeadDetailPanel lead={fullLead} response={selected?.provider_response} locationId={locationId}
      canRespond={Boolean(entitlement?.feature_keys?.includes("provider_leads.respond"))} canAccessContact={entitlement?.plan_code === "pro" && entitlement.feature_keys?.includes("provider_contact.access_after_consent")}
      canChat={false} onMarkViewed={id => act(id)} onRespond={act} marking={marking} responding={responding} hideActions hideConversation />
      : <div className="inbox-empty" role="status">{detailLoading ? "Se încarcă detaliile…" : "Detaliile nu au putut fi încărcate."}<button type="button" className="inbox-button" onClick={loadDetail}>Reîncearcă</button></div>}
  </aside>;
  return <section className="provider-inbox" data-selected={Boolean(selectedId)}>
    <header className="inbox-heading"><div><h1>Cereri</h1><p>{location?.public_display_name || location?.name || "Locația selectată"}{current ? ` · ${current.counters?.active || 0} active · ${current.unread_conversations || 0} conversații necitite` : ""}</p></div><div className="inbox-tools"><ProviderNotificationCenter locations={[]} locationId={locationId} onOpenTarget={openNotification} /><button type="button" className="inbox-button" disabled={loading} onClick={() => void load()} aria-label="Actualizează cererile"><RefreshCw /><span className="inbox-refresh-label">Actualizează</span></button></div></header>
    {error && <div role="alert" className="inbox-error">{error} <button type="button" className="inbox-button" onClick={() => { void load(); void loadDetail(); }}>Reîncearcă</button></div>}
    {entitlement?.plan_code !== "pro" && current && !selectedId && <p className="inbox-access-note">Locația are acces la rezumatele cererilor. {onOpenRequestSettings && <button type="button" onClick={onOpenRequestSettings}>Plan și acces</button>}</p>}
    <div className="inbox-shell" ref={shellRef}>
      <div className="inbox-list" ref={node => node?.toggleAttribute("inert", detailsOpen && !threeColumns)}><InboxFilters filter={filter} status={status} search={search} onChange={value => { resetSelection(); setFilter(value); setOffset(0); }} onStatus={value => { resetSelection(); setStatus(value); setOffset(0); }} onSearch={value => { resetSelection(); setSearch(value); }} />
        <div className="inbox-rows" aria-busy={loading}>{!current && loading ? <div className="inbox-empty" role="status"><Loader2 className="mx-auto animate-spin" />Se încarcă cererile…</div> : listedLeads.length ? listedLeads.map(row => <LeadListItem key={row.id} lead={row} selected={row.id === selectedId} onSelect={() => select(row)} />) : <div className="inbox-empty"><strong>{filter === "unread" ? "Nicio conversație necitită" : filter === "history" ? "Nicio cerere încheiată" : "Nicio cerere în această categorie"}</strong>{filter === "unread" ? "Mesajele noi vor apărea aici." : "Cererile eligibile apar după acordul clientului."}</div>}</div>
        <InboxPagination page={current?.pagination} count={current?.leads?.length || 0} busy={loading} onPage={value => { resetSelection(); setOffset(value); }} />
      </div>
      <div className="inbox-conversation-slot" ref={node => node?.toggleAttribute("inert", detailsOpen && !threeColumns)}><LeadConversationPanel readVisible={!detailsOpen || threeColumns} lead={fullLead} locationId={locationId} entitlement={entitlement} loading={detailLoading || !currentDetail} responding={responding} onRespond={act} onBack={resetSelection} onDetails={() => setDetailsOpen(true)} onChatChanged={chatChanged} /></div>
      {detailsOpen && !threeColumns && <button type="button" className="inbox-detail-scrim" aria-label="Închide detaliile" onClick={() => setDetailsOpen(false)} />}
      {details}
    </div>
  </section>;
}
