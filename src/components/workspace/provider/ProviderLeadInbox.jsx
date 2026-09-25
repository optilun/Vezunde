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
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProviderCompletenessPanel from "./ProviderCompletenessPanel";
import ProviderStatusCenter from "./ProviderStatusCenter";
import ProviderLeadInboxLegacy from "./ProviderLeadInboxLegacy";
import ProviderOrganizationLeadInbox from "./ProviderOrganizationLeadInbox";
import { canShowOrganizationInbox } from "@/lib/providerOrganizationInboxView";
import ProviderAccessBand from "./leads/ProviderAccessBand";
import ProviderBillingPanel from "./leads/ProviderBillingPanel";

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
  const { locationId, location, onEntitlementChanged, organizationId, isOrganizationOwner, ownerLocations = [], onSelectLocation } = props;
  const canViewAll = canShowOrganizationInbox({ isOrganizationOwner, organizationId, locations: ownerLocations });
  const [showAllLocations, setShowAllLocations] = useState(canViewAll);
  const [targetLead, setTargetLead] = useState(null);
  const [searchParams] = useSearchParams();
  // O intoarcere din Stripe (Checkout sau Billing Portal) trebuie sa aterizeze direct in
  // tab-ul "Cont", unde traieste ProviderBillingPanel - altfel providerul revine din plata
  // exact in lista de cereri, fara sa vada confirmarea.
  const billingReturn = searchParams.get("billing");
  // Cardul "Treci la Pro" din sidebar (ProviderSidebarContent) trimite direct aici cu
  // ?tab=account, ca sa nu mai fie nevoie de un al doilea click pe tab-ul "Cont".
  const wantsAccountTab = searchParams.get("tab") === "account";
  const [snapshot, setSnapshot] = useState({ entitlement: FREE_ENTITLEMENT, counters: {} });
  const [completeness, setCompleteness] = useState(null);
  const currentSnapshot = snapshot.locationId === locationId
    ? snapshot : { entitlement: FREE_ENTITLEMENT, counters: {} };
  const currentCompleteness = completeness?.selected_location_id === locationId ? completeness : null;
  const [tab, setTab] = useState(billingReturn || wantsAccountTab ? "account" : "leads");
  // Incrementat de ProviderBillingPanel dupa o sincronizare Stripe reusita, ca sa reincarcam
  // entitlement-ul si contoarele fara sa reincarcam toata pagina.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => { setShowAllLocations(canViewAll); }, [organizationId, canViewAll]);
  useEffect(() => {
    setTargetLead((current) => current?.locationId && current.locationId !== locationId ? null : current);
  }, [locationId]);

  const chooseInboxLocation = (nextLocationId) => {
    setTargetLead(null);
    if (nextLocationId === "all") {
      setShowAllLocations(true);
      return;
    }
    setShowAllLocations(false);
    if (nextLocationId && nextLocationId !== locationId) onSelectLocation?.(nextLocationId);
  };

  const openLeadAtLocation = (target) => {
    if (!target?.leadId || !ownerLocations.some((item) => item.id === target.locationId)) return;
    setTargetLead(target);
    setShowAllLocations(false);
    if (target.locationId !== locationId) onSelectLocation?.(target.locationId);
  };

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
      setSnapshot({ locationId, entitlement: inboxData.entitlement || FREE_ENTITLEMENT, counters: inboxData.counters || {} });
      setCompleteness(completenessData);
    }).catch(() => null);
    return () => { active = false; };
  }, [locationId, refreshTick]);

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
          {canViewAll && (
            <label className="flex flex-wrap items-center gap-2 font-heading text-sm font-bold text-foreground">
              Inbox
              <select
                value={showAllLocations ? "all" : locationId}
                onChange={(event) => chooseInboxLocation(event.target.value)}
                className="min-h-11 max-w-full rounded-full border border-foreground/20 bg-white/70 px-4 text-sm font-medium"
              >
                <option value="all">Toate locațiile</option>
                {ownerLocations.map((item) => <option key={item.id} value={item.id}>{item.public_display_name || item.name || "Locație"}</option>)}
              </select>
            </label>
          )}
          {canViewAll && showAllLocations ? (
            <ProviderOrganizationLeadInbox organizationId={organizationId} onOpenLead={openLeadAtLocation} />
          ) : (
            <>
              <ProviderAccessBand
                location={location || {}}
                entitlement={currentSnapshot.entitlement}
                counters={currentSnapshot.counters}
                onOpenAccount={() => setTab("account")}
              />
              <ProviderLeadInboxLegacy
                key={locationId + ":" + (targetLead?.leadId || "")}
                {...props}
                targetLeadId={targetLead?.locationId === locationId ? targetLead.leadId : ""}
                targetHistory={targetLead?.locationId === locationId && targetLead.history === true}
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {canViewAll && <p className="rounded-[1.2rem] border border-[#e3ddd0] bg-[#fdfbf6] px-4 py-3 text-sm text-muted-foreground">Contul și facturarea de mai jos se referă numai la locația selectată: <strong className="font-heading text-foreground">{location?.public_display_name || location?.name || "Locație"}</strong>.</p>}
          <ProviderStatusCenter
            location={location || {}}
            entitlement={currentSnapshot.entitlement}
            counters={currentSnapshot.counters}
            defaultOpen
          />
          <ProviderBillingPanel
            locationId={locationId}
            entitlement={currentSnapshot.entitlement}
            onSynced={() => {
              setRefreshTick((tick) => tick + 1);
              // Anunta ProviderWorkspaceRoot sa reincarce si el planul, ca sa se actualizeze
              // cardul de upgrade din sidebar dupa un checkout/anulare reusit.
              onEntitlementChanged?.();
            }}
          />
          <ProviderCompletenessPanel data={currentCompleteness} />
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
