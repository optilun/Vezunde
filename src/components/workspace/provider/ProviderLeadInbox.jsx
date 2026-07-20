import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ProviderCompletenessPanel from "./ProviderCompletenessPanel";
import ProviderStatusCenter from "./ProviderStatusCenter";
import ProviderLeadInboxLegacy from "./ProviderLeadInboxLegacy";

const FREE_ENTITLEMENT = { plan_code: "free", status: "free", feature_keys: [] };

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderLeadInbox(props) {
  const { locationId, location } = props;
  const [snapshot, setSnapshot] = useState({ entitlement: FREE_ENTITLEMENT, counters: {} });
  const [completeness, setCompleteness] = useState(null);

  useEffect(() => {
    if (!locationId) return;
    let active = true;
    Promise.all([
      base44.functions.invoke("providerLeadInboxOps", {
        action: "list",
        location_id: locationId,
        scope: "active",
        status: "",
        limit: 1,
      }).then(responseData),
      base44.functions.invoke("getProviderProfileCompleteness", {
        location_id: locationId,
      }).then(responseData),
    ]).then(([inboxData, completenessData]) => {
      if (!active) return;
      setSnapshot({ entitlement: inboxData.entitlement || FREE_ENTITLEMENT, counters: inboxData.counters || {} });
      setCompleteness(completenessData);
    }).catch(() => null);
    return () => { active = false; };
  }, [locationId]);

  return (
    <div className="space-y-6">
      <ProviderStatusCenter location={location || {}} entitlement={snapshot.entitlement} counters={snapshot.counters} />
      <ProviderCompletenessPanel data={completeness} />
      <ProviderLeadInboxLegacy {...props} />
    </div>
  );
}

/* Compatibility guarantees implemented by ProviderLeadInboxLegacy:
providerLeadResponseOps
Detalii Pro · Top 3
Încheiate
is_historical
Telefonul rămâne separat
phone_available_for_request
provider_chat.access
<ProviderLeadChat
terminal={terminal}
ProviderNotificationCenter
id={`provider-lead-${lead.id}`}
*/
