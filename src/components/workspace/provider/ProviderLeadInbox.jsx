// Modulul de leaduri, organizat ca o aplicatie de mesagerie (2026-08-22).
//
// Inainte, cele trei bucati (status locatie, completarea profilului, inbox) stateau una
// sub alta, fiecare cu propriul stil de card: cine intra sa vada "am o cerere noua?"
// trebuia sa treaca prin doua panouri administrative. Acum ecranul are doua tab-uri, ca
// in aplicatiile de conversatii: "Cereri" e vedeta si e implicit, iar "Plan și acces" tine
// starea planului, accesul la cereri si completarea profilului.
//
// 2026-10-04 (audit cont organizație, #7): tabul se numea „Cont” și repeta tot panoul de
// facturare din Setări → Abonament și facturare. Acum arată doar starea și un link spre Setări;
// plata, facturile și schimbarea planului rămân într-un singur loc.
//
// Nimic nu a fost sters: ProviderStatusCenter si ProviderCompletenessPanel raman intregi,
// se schimba doar locul in care traiesc. Regulile de acces (Pro, Top 3, acordul clientului)
// nu sunt atinse.
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProviderCompletenessPanel from "./ProviderCompletenessPanel";
import ProviderStatusCenter from "./ProviderStatusCenter";
import ProviderLeadInboxLegacy from "./ProviderLeadInboxLegacy";
import ProviderOrganizationLeadInbox from "./ProviderOrganizationLeadInbox";
import { canShowOrganizationInbox } from "@/lib/providerOrganizationInboxView";
import ProviderAccessBand from "./leads/ProviderAccessBand";
import { ArrowRight, CreditCard, RefreshCw } from "lucide-react";
import { withTransientRetry } from "@/lib/transientRetry";
import { INBOX_PLAN_UNKNOWN_MESSAGE, INBOX_RETRY_OPTIONS } from "@/lib/providerInboxErrors";

const FREE_ENTITLEMENT = { plan_code: "free", status: "free", feature_keys: [] };

// 2026-10-04 (audit cont organizație, #1): când planul nu a putut fi verificat, spunem asta și
// oferim reîncercarea, în loc să afișăm „Plan Free” și limitări care nu există.
function PlanUnknownNotice({ onRetry }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-[1.2rem] border border-[#dac69b] bg-[#fbf3df] px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{INBOX_PLAN_UNKNOWN_MESSAGE}</span>
      <button type="button" onClick={onRetry} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/80 px-4 font-heading text-[12px] font-bold hover:border-foreground/45">
        <RefreshCw className="h-3.5 w-3.5" /> Reîncearcă
      </button>
    </div>
  );
}

const TABS = [
  { key: "leads", label: "Cereri" },
  { key: "account", label: "Plan și acces" },
];

// Abonamentul se gestionează doar în Setări. Cine nu are acces la Setări află cine îl administrează.
function BillingShortcut({ onOpenBilling }) {
  return (
    <div className="flex flex-col gap-3 rounded-[1.2rem] border border-[#e3ddd0] bg-[#fdfbf6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <CreditCard aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-heading text-[13.5px] font-extrabold tracking-[-0.02em] text-foreground">Abonament și facturare</p>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {onOpenBilling
              ? "Plata, facturile și schimbarea planului sunt în Setări → Abonament și facturare."
              : "Abonamentul organizației îl administrează proprietarul contului."}
          </p>
        </div>
      </div>
      {onOpenBilling && (
        <button type="button" onClick={onOpenBilling} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45">
          Deschide abonamentul <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderLeadInbox(props) {
  const { locationId, location, organizationId, isOrganizationOwner, ownerLocations = [], onSelectLocation, onOpenBilling } = props;
  const canViewAll = canShowOrganizationInbox({ isOrganizationOwner, organizationId, locations: ownerLocations });
  const [showAllLocations, setShowAllLocations] = useState(canViewAll);
  const [targetLead, setTargetLead] = useState(null);
  const [searchParams] = useSearchParams();
  // Stripe se întoarce în Setări → Abonament și facturare (din 2026-09-14). Dacă un link vechi
  // aduce totuși ?billing= aici, îl trimitem acolo, unde se face sincronizarea plății.
  const billingReturn = searchParams.get("billing");
  // Un link cu ?tab=account deschide direct „Plan și acces”.
  const wantsAccountTab = searchParams.get("tab") === "account";
  // status: loading | ready | error. Planul e folosit doar când e „ready”.
  const [snapshot, setSnapshot] = useState({ status: "loading", entitlement: null, counters: {} });
  const [completeness, setCompleteness] = useState(null);
  const currentSnapshot = snapshot.locationId === locationId
    ? snapshot : { status: "loading", entitlement: null, counters: {} };
  const planReady = currentSnapshot.status === "ready";
  const planFailed = currentSnapshot.status === "error";
  const currentCompleteness = completeness?.selected_location_id === locationId ? completeness : null;
  const [tab, setTab] = useState(billingReturn || wantsAccountTab ? "account" : "leads");
  // Incrementat la „Reîncearcă”, ca sa reincarcam planul si contoarele fara toata pagina.
  const [refreshTick, setRefreshTick] = useState(0);
  const retryPlan = () => {
    setSnapshot((current) => ({ ...current, status: "loading" }));
    setRefreshTick((tick) => tick + 1);
  };

  const openBillingRef = useRef(onOpenBilling);
  openBillingRef.current = onOpenBilling;
  useEffect(() => { if (billingReturn) openBillingRef.current?.(); }, [billingReturn]);
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
    withTransientRetry(() => base44.functions.invoke("providerLeadInboxOps", {
      action: "list",
      location_id: locationId,
      scope: "active",
      status: "",
      limit: 1,
    }).then(responseData), INBOX_RETRY_OPTIONS)
      .then((inboxData) => {
        if (active) setSnapshot({ locationId, status: "ready", entitlement: inboxData.entitlement || FREE_ENTITLEMENT, counters: inboxData.counters || {} });
      })
      .catch(() => {
        if (active) setSnapshot({ locationId, status: "error", entitlement: null, counters: {} });
      });
    // Completarea profilului e separată: dacă ea nu se încarcă, planul tot se afișează.
    withTransientRetry(() => base44.functions.invoke("getProviderProfileCompleteness", {
      location_id: locationId,
    }).then(responseData), INBOX_RETRY_OPTIONS)
      .then((completenessData) => { if (active) setCompleteness(completenessData); })
      .catch(() => null);
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
              {planReady && (
                <ProviderAccessBand
                  location={location || {}}
                  entitlement={currentSnapshot.entitlement}
                  counters={currentSnapshot.counters}
                  onOpenAccount={() => setTab("account")}
                />
              )}
              {planFailed && <PlanUnknownNotice onRetry={retryPlan} />}
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
          {canViewAll && <p className="rounded-[1.2rem] border border-[#e3ddd0] bg-[#fdfbf6] px-4 py-3 text-sm text-muted-foreground">Starea cererilor de mai jos este pentru locația selectată: <strong className="font-heading text-foreground">{location?.public_display_name || location?.name || "Locație"}</strong>. Abonamentul este pentru toată organizația.</p>}
          {planReady && (
            <ProviderStatusCenter
              location={location || {}}
              entitlement={currentSnapshot.entitlement}
              counters={currentSnapshot.counters}
              defaultOpen
            />
          )}
          {planFailed && <PlanUnknownNotice onRetry={retryPlan} />}
          <BillingShortcut onOpenBilling={onOpenBilling} />
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
