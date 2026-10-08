import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProviderLeadInboxLegacy from "./ProviderLeadInboxLegacy";
import ProviderOrganizationLeadInbox from "./ProviderOrganizationLeadInbox";
import { canShowOrganizationInbox } from "@/lib/providerOrganizationInboxView";
import "@/styles/provider-lead-inbox.css";

export default function ProviderLeadInbox(props) {
  const { locationId, organizationId, isOrganizationOwner, ownerLocations = [], onSelectLocation, onOpenRequestSettings, onOpenBilling } = props;
  const [params] = useSearchParams();
  const billingReturn = params.get("billing");
  const openBillingRef = useRef(onOpenBilling);
  openBillingRef.current = onOpenBilling;
  useEffect(() => { if (billingReturn) openBillingRef.current?.(); }, [billingReturn]);
  const canViewAll = canShowOrganizationInbox({ organizationId, isOrganizationOwner, locations: ownerLocations });
  const [showAll, setShowAll] = useState(canViewAll);
  const [target, setTarget] = useState(null);
  useEffect(() => { setShowAll(canViewAll); setTarget(null); }, [organizationId, canViewAll]);
  useEffect(() => { if (!billingReturn && params.get("tab") === "account") onOpenRequestSettings?.(); }, [billingReturn, params, onOpenRequestSettings]);
  const choose = id => { setTarget(null); setShowAll(id === "all"); if (id !== "all" && id !== locationId) onSelectLocation?.(id); };
  const open = next => {
    if (!next?.leadId || !ownerLocations.some(row => row.id === next.locationId)) return;
    setTarget(next); setShowAll(false);
    if (next.locationId !== locationId) onSelectLocation?.(next.locationId);
  };
  return <div className="provider-inbox">
    {canViewAll && <label className="inbox-organization-scope">Inbox <select aria-label="Locația inboxului" value={showAll ? "all" : locationId} onChange={event => choose(event.target.value)}><option value="all">Toate locațiile</option>{ownerLocations.map(row => <option key={row.id} value={row.id}>{row.public_display_name || row.name || "Locație"}</option>)}</select></label>}
    {canViewAll && showAll ? <ProviderOrganizationLeadInbox organizationId={organizationId} onOpenLead={open} /> : <ProviderLeadInboxLegacy key={locationId + ":" + (target?.locationId === locationId ? target?.leadId || "" : "")} {...props} targetLeadId={target?.locationId === locationId ? target.leadId : ""} targetHistory={target?.locationId === locationId && target.history === true} />}
  </div>;
}
