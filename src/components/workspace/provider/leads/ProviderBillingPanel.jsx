// Panoul de abonament Pro - checkout self-service Stripe (2026-09-11).
//
// Traieste in tab-ul "Cont" din ProviderLeadInbox, intre ProviderStatusCenter si
// ProviderCompletenessPanel. Nu decide niciodata singur planul sau statusul - citeste
// entitlement-ul deja calculat de getProviderEntitlement (acelasi apel folosit in tot
// workspace-ul) si doar initiaza actiunile Stripe (checkout, billing portal) prin
// createProviderCheckoutSession / createProviderBillingPortalSession, apoi confirma
// rezultatul prin syncProviderStripeSubscription la intoarcerea din Stripe.
//
// De ce sincronizarea se face aici si nu doar prin webhook: vezi stripeBillingWebhook.ts -
// platforma Base44 poate intercepta acel request inainte sa ajunga la cod. Confirmarea de
// aici (la intoarcerea din Checkout/Billing Portal, cat timp providerul e inca autentificat)
// este sincronizarea garantata; reconcileProviderStripeSubscriptions (workflow periodic) e
// plasa de siguranta pentru orice se intampla direct in Stripe, fara ca providerul sa mai
// deschida vreodata workspace-ul.
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";

const GRAIN = { backgroundImage: "url('/images/home/viasee-technical-grain.svg')", backgroundSize: "180px 180px" };

// Acelasi enum ca in providerEntitlementPolicy.js - un plan Pro conteaza activ si in
// gratia (grace_period) sau in perioada de proba (trialing), nu doar cand statusul e "active".
const PRO_ACTIVE_STATUSES = new Set(["active", "trialing", "grace_period"]);

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

export default function ProviderBillingPanel({ locationId, entitlement, onSynced }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const billingParam = searchParams.get("billing");
  const sessionIdParam = searchParams.get("session_id");

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");
  const [portalUnavailable, setPortalUnavailable] = useState(false);

  const isPro = entitlement?.plan_code === "pro" && PRO_ACTIVE_STATUSES.has(entitlement?.status);

  // Intoarcere din Stripe Checkout (billing=success) sau din Billing Portal
  // (billing=portal_return): confirmam sincron cat timp providerul e inca autentificat, in loc
  // sa ne bazam doar pe webhook (vezi nota de mai sus).
  useEffect(() => {
    if (!locationId || !billingParam) return;
    if (billingParam !== "success" && billingParam !== "portal_return") return;
    let active = true;
    setSyncing(true);
    setSyncError("");
    base44.functions.invoke("syncProviderStripeSubscription", {
      location_id: locationId,
      session_id: sessionIdParam || undefined,
    }).then(responseData).then(() => {
      if (!active) return;
      onSynced?.();
    }).catch((error) => {
      if (!active) return;
      setSyncError(error?.message || "Sincronizarea cu Stripe a esuat.");
    }).finally(() => {
      if (active) setSyncing(false);
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, billingParam, sessionIdParam]);

  // Curata URL-ul dupa ce am citit parametrii de intoarcere - altfel un refresh de pagina
  // ar re-trimite acelasi session_id catre syncProviderStripeSubscription.
  useEffect(() => {
    if (!billingParam) return;
    const next = new URLSearchParams(searchParams);
    next.delete("billing");
    next.delete("session_id");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billingParam]);

  async function handleCheckout() {
    setActionLoading("checkout");
    setActionError("");
    setPortalUnavailable(false);
    try {
      const data = await base44.functions.invoke("createProviderCheckoutSession", {
        location_id: locationId,
        return_base_url: window.location.origin,
      }).then(responseData);
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setActionError("Sesiunea de plata Stripe nu a putut fi creata.");
    } catch (error) {
      setActionError(error?.message || "Sesiunea de plata Stripe nu a putut fi creata.");
    } finally {
      setActionLoading("");
    }
  }

  async function handlePortal() {
    setActionLoading("portal");
    setActionError("");
    setPortalUnavailable(false);
    try {
      const data = await base44.functions.invoke("createProviderBillingPortalSession", {
        location_id: locationId,
        return_base_url: window.location.origin,
      }).then(responseData);
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setActionError("Sesiunea de gestionare a abonamentului nu a putut fi creata.");
    } catch (error) {
      // Un plan Pro acordat manual de admin (billing_mode: 'manual') nu are customer Stripe -
      // endpoint-ul raspunde 404, si aici alegem un mesaj clar in loc sa aratam eroarea bruta.
      setPortalUnavailable(true);
      setActionError(error?.message || "Sesiunea de gestionare a abonamentului nu a putut fi creata.");
    } finally {
      setActionLoading("");
    }
  }

  return (
    <div className="space-y-3 rounded-[1.4rem] border border-[#e3ddd0] bg-[#fdfbf6] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            style={{ borderColor: isPro ? "#ccd2ba" : "#dac69b", backgroundColor: isPro ? "#dfe3d2" : "#eadcba" }}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border"
          >
            <span className="absolute inset-0 opacity-30 mix-blend-multiply" style={GRAIN} />
            {isPro
              ? <ShieldCheck className="relative z-10 h-4 w-4 text-black/55" />
              : <CreditCard className="relative z-10 h-4 w-4 text-black/55" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-[13.5px] font-extrabold tracking-[-0.025em] text-foreground">
              {isPro ? "Plan Pro activ" : "Plan Free"}
            </p>
            <p className="truncate text-[12px] leading-relaxed text-muted-foreground">
              {isPro ? "49 RON/luna, plata prin Stripe." : "Treci la Pro pentru 49 RON/luna."}
            </p>
          </div>
        </div>

        {isPro ? (
          <button
            type="button"
            onClick={handlePortal}
            disabled={actionLoading === "portal"}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-foreground/20 bg-white/70 px-4 font-heading text-[12px] font-bold text-foreground transition-colors hover:border-foreground/45 disabled:opacity-60"
          >
            {actionLoading === "portal" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Gestioneaza abonamentul
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheckout}
            disabled={actionLoading === "checkout"}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#171717] px-5 font-heading text-[12px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {actionLoading === "checkout" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Treci la Pro — 49 RON/luna
          </button>
        )}
      </div>

      {syncing && (
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Se sincronizeaza cu Stripe...
        </p>
      )}
      {syncError && <p className="text-[12px] text-red-700">{syncError}</p>}
      {actionError && (
        <p className="text-[12px] text-red-700">
          {portalUnavailable
            ? "Acest plan Pro este administrat de VIASEE si nu are un abonament Stripe de gestionat. Contacteaza echipa VIASEE pentru modificari."
            : actionError}
        </p>
      )}
    </div>
  );
}
