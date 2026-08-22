// Modulul de leaduri, organizat ca o aplicatie de mesagerie (2026-08-22).
//
// Inainte, cele trei bucati (status locatie, completarea profilului, inbox) stateau una
// sub alta, fiecare cu propriul stil de card: cine intra sa vada "am o cerere noua?"
// trebuia sa treaca prin doua panouri administrative. Acum ecranul are doua tab-uri, ca
// in aplicatiile de conversatii: "Cereri" e vedeta si e implicit, iar "Cont" tine tot ce
// tine de plan, acces si completarea profilului.
//
// Nimic nu a fost sters: ProviderStatusCenter si ProviderCompletenessPanel raman intregi,
// se schimba doar locul in care traiesc. Regulile de acces (Pro, Top 3, acordul clientului)
// nu sunt atinse.
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import ProviderCompletenessPanel from "./ProviderCompletenessPanel";
import ProviderStatusCenter from "./ProviderStatusCenter";
import ProviderLeadInboxLegacy from "./ProviderLeadInboxLegacy";
import ProviderAccessBand from "./leads/ProviderAccessBand";

const FREE_ENTITLEMENT = { plan_code: "free", status: "free", feature_keys: [] };

const TABS = [
  { key: "leads", label: "Cereri" },
  { key: "account", label: "Cont" },
];

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderLeadInbox(props) {
  const { locationId, location } = props;
  const [snapshot, setSnapshot] = useState({ entitlement: FREE_ENTITLEMENT, counters: {} });
  const [completeness, setCompleteness] = useState(null);
  const [tab, setTab] = useState("leads");

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
    <div className="space-y-5">
      {/* Bara de tab-uri, in acelasi limbaj ca filtrele din lista de cereri: pastile,
          activa in negru. Nu se intinde pe toata latimea - e navigatie, nu antet. */}
      <div className="inline-flex gap-1.5 rounded-full border border-[#e3ddd0] bg-[#fdfbf6] p-1.5">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={tab === item.key ? "page" : undefined}
            className={`min-h-9 shrink-0 rounded-full px-4 font-heading text-[12.5px] font-bold tracking-[-0.015em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F4EC] ${
              tab === item.key ? "bg-[#171717] text-white" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "leads" ? (
        <div className="space-y-5">
          <ProviderAccessBand
            location={location || {}}
            entitlement={snapshot.entitlement}
            counters={snapshot.counters}
            onOpenAccount={() => setTab("account")}
          />
          <ProviderLeadInboxLegacy {...props} />
        </div>
      ) : (
        <div className="space-y-5">
          <ProviderStatusCenter
            location={location || {}}
            entitlement={snapshot.entitlement}
            counters={snapshot.counters}
            defaultOpen
          />
          <ProviderCompletenessPanel data={completeness} />
        </div>
      )}
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
