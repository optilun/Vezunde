import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, FileText, Loader2, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SETTINGS_GRAIN, SETTINGS_TONES, SETTINGS_BUTTON, SETTINGS_PRIMARY } from "../settingsVisuals";
import { money } from "../../../../lib/billingFormat.js";

export { money };
const date = value => value ? new Date(typeof value === "number" ? value * 1000 : value).toLocaleDateString("ro-RO") : "—";
export const BILLING_STATUSES = {
  configuration_review: "Necesită verificare VIASEE",
  requires_action: "Necesită confirmare", requires_payment_method: "Așteaptă metodă de plată", processing: "În procesare", requires_capture: "Autorizată", requires_confirmation: "Așteaptă confirmare",
  active: "Activ", trialing: "Perioadă de probă", past_due: "Plată restantă", unpaid: "Neplătit",
  incomplete: "Plată nefinalizată", incomplete_expired: "Plată expirată", canceled: "Anulat", paused: "Suspendat",
  draft: "Ciornă", open: "De plată", paid: "Plătită", void: "Anulată", uncollectible: "Nerecuperabilă",
  succeeded: "Încasată", pending: "În procesare", failed: "Respinsă", blocked: "Blocată",
  refunded: "Rambursată", partially_refunded: "Rambursată parțial", disputed: "Contestată",
};
export function BillingStatus({ status }) {
  const color = ["active","paid","succeeded"].includes(status) ? "bg-emerald-50 text-emerald-800" :
    ["failed","blocked","past_due","unpaid","uncollectible","disputed","configuration_review"].includes(status) ? "bg-red-50 text-red-800" : "bg-secondary text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{BILLING_STATUSES[status] || status || "—"}</span>;
}
const button = SETTINGS_BUTTON;
const field = "mt-1 h-11 w-full rounded-xl border border-[#d8d2c5] bg-white px-3 text-sm outline-none focus:border-[#3559c7] focus:ring-2 focus:ring-[#3559c7]/20";
function Panel({ title, icon: Icon, children, action, tone = "blue" }) {
  const colors = SETTINGS_TONES[tone];
  return <section className="overflow-hidden rounded-[1.5rem] border bg-[#fdfbf6]" style={{ borderColor: colors.border }}>
    <div className="relative flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20" style={SETTINGS_GRAIN} />
      <h3 className="relative flex items-center gap-2.5 text-base font-semibold">{Icon && <Icon className="h-4 w-4" />}{title}</h3>{action}
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </section>;
}
async function invoke(name, payload) {
  try {
    const response = await base44.functions.invoke(name, payload);
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  } catch (error) { throw new Error(error?.response?.data?.error || error.message || "Operațiunea nu a reușit."); }
}
function profileFrom(customer) {
  return { billing_type: customer?.billing_type || "company", billing_name: customer?.name || "", billing_email: customer?.email || "", billing_cui: customer?.cui || "",
    billing_address: { line1: customer?.address?.line1 || "", city: customer?.address?.city || "", state: customer?.address?.state || "", postal_code: customer?.address?.postal_code || "", country: customer?.address?.country || "RO" } };
}
export function InvoiceTable({ invoices }) {
  if (!invoices.length) return <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[#d8d2c5] bg-[#f8f4ec] p-5">
    <FileText aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#75634b]" /><div><p className="text-sm font-semibold">Niciun document în această pagină</p><p className="mt-1 text-sm text-muted-foreground">Documentele asociate abonamentului apar aici după generarea lor în Stripe.</p></div>
  </div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm">
    <thead className="bg-[#f1ecdf] text-xs text-[#665b4a]"><tr>{["Dată / Document Stripe","Stare","Total","Rest de plată","Document"].map(t => <th key={t} className="border-b border-border px-2 py-3 font-medium">{t}</th>)}</tr></thead>
    <tbody>{invoices.map(invoice => <tr key={invoice.id} className="border-b border-border transition hover:bg-[#f8f4ec] last:border-0">
      <td className="px-2 py-4">{date(invoice.created)}<p className="text-xs text-muted-foreground">{invoice.number || "Număr nealocat"}</p></td>
      <td className="px-2 py-4"><BillingStatus status={invoice.status} />{invoice.status === "open" && invoice.attempted && <p className="mt-1 text-xs text-muted-foreground">{invoice.attempt_count} încercări de încasare</p>}</td>
      <td className="px-2 py-4">{money(invoice.total, invoice.currency)}</td><td className="px-2 py-4">{money(invoice.amount_remaining, invoice.currency)}</td>
      <td className="px-2 py-4"><div className="flex gap-3">{invoice.hosted_invoice_url && <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{invoice.status === "open" ? "Vezi / plătește" : "Vezi"}</a>}{invoice.invoice_pdf && <a href={invoice.invoice_pdf} target="_blank" rel="noreferrer" className="underline underline-offset-4" aria-label={`Descarcă documentul Stripe ${invoice.number || ""} PDF`}>PDF Stripe</a>}</div></td>
    </tr>)}</tbody>
  </table></div>;
}
// 2026-10-04 (structura conturilor, pasul 4): abonamentul se plătește pe organizație. Cu
// organizationId, panoul arată pachetul după numărul de locații active, ofertele Enterprise și
// abonamentele vechi pe locație. Fără organizationId rămâne comportamentul vechi, pe locație.
export default function ProviderBillingPanel(props) {
  return <BillingCenter key={`${props.organizationId || ""}:${props.locationId || ""}`} {...props} />;
}
const locationsLabel = count => `${count} ${count === 1 ? "locație activă" : "locații active"}`;
function PlanTiers({ pricing }) {
  const tiers = pricing?.tiers || [];
  if (!tiers.length) return null;
  const current = pricing.current_tier?.key;
  return <div className="mt-4 overflow-hidden rounded-2xl border border-[#d8d2c5]">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">Pachetele VIASEE Pro după numărul de locații active</caption>
      <tbody>
        {tiers.map(tier => <tr key={tier.key} className={`border-b border-[#e7e1d4] last:border-0 ${current === tier.key ? "bg-[#e9f2e6] font-semibold" : ""}`}>
          <th scope="row" className="px-3 py-2.5 font-medium">{tier.label}</th>
          <td className="px-3 py-2.5 text-muted-foreground">{tier.min === tier.max ? `${tier.min} locație` : `${tier.min}–${tier.max} locații`}</td>
          <td className="whitespace-nowrap px-3 py-2.5 text-right">{money(tier.amount, pricing.currency)} / lună</td>
        </tr>)}
        <tr className={pricing.enterprise_required ? "bg-[#e9f2e6] font-semibold" : ""}>
          <th scope="row" className="px-3 py-2.5 font-medium">Enterprise</th>
          <td className="px-3 py-2.5 text-muted-foreground">peste {(pricing.enterprise_min_locations || 16) - 1} locații</td>
          <td className="px-3 py-2.5 text-right">ofertă cu contract</td>
        </tr>
      </tbody>
    </table>
  </div>;
}
function CustomerSummary({ customer }) {
  return <div className="min-w-0 break-words text-sm"><p className="font-medium">{customer.name}</p><p className="mt-1 text-muted-foreground">{customer.cui ? "CUI " + customer.cui + " · " : ""}{customer.email}</p><p className="mt-1 text-muted-foreground">{[customer.address?.line1, customer.address?.city, customer.address?.country].filter(Boolean).join(", ")}</p></div>;
}
function BillingCenter({ organizationId, locationId, onSynced }) {
  const [params, setParams] = useSearchParams();
  const billing = params.get("billing"), sessionId = params.get("session_id");
  const [data, setData] = useState(null), [profile, setProfile] = useState(profileFrom(null));
  const [editingDetails, setEditingDetails] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true), [tick, setTick] = useState(0);
  const [cursors, setCursors] = useState([null]), [page, setPage] = useState(0);
  const [acceptedOffers, setAcceptedOffers] = useState({});
  const lock = useRef(false), sequence = useRef(0), synced = useRef(onSynced);
  const profileInitialized = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  synced.current = onSynced;
  const cursor = cursors[page];
  const scope = organizationId ? { organization_id: organizationId, location_id: locationId || undefined } : { location_id: locationId };
  const scopeKey = `${organizationId || ""}:${locationId || ""}`;
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setError("");
    const target = organizationId ? { organization_id: organizationId, location_id: locationId || undefined } : { location_id: locationId };
    try {
      if (billing === "success" || billing === "portal_return") {
        await invoke("syncProviderStripeSubscription", { ...target, session_id: sessionId || undefined });
      }
      const result = await invoke("providerBillingOps", { ...target, cursor });
      if (request !== sequence.current) return;
      setData(result);
      // Invoice pagination and retries must not overwrite an unsaved billing form.
      if (!profileInitialized.current) { setProfile(profileFrom(result.customer || result.customer_suggestion)); setEditingDetails(!result.customer?.name); profileInitialized.current = true; }
      synced.current?.();
      if (billing === "success" || billing === "portal_return") {
        setNotice(billing === "success" ? "Starea abonamentului a fost verificată cu Stripe." : "Ai revenit din Stripe. Datele de facturare sunt la zi.");
        // Keep return parameters until both confirmation and reload have succeeded.
        setParams(current => { const next = new URLSearchParams(current); next.delete("billing"); next.delete("session_id"); return next; }, { replace: true });
      } else if (billing === "cancelled") {
        setNotice("Ai închis plata. Poți relua activarea Pro când dorești.");
      }
    } catch (err) { if (request === sequence.current) setError(err.message); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [billing, sessionId, organizationId, locationId, cursor, setParams]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- la curatare se invalideaza cererea in curs, deci conteaza valoarea de acum a contorului
  useEffect(() => { if (locationId || organizationId) void load(); return () => { sequence.current++; }; }, [load, scopeKey, tick]);
  async function run(action, flow, extra = {}) {
    if (lock.current || !mounted.current) return;
    lock.current = true; setBusy(extra.offer_id ? `offer:${extra.offer_id}` : action); setError(""); setNotice("");
    try {
      if (action === "save" || action === "checkout") {
        if (action === "save" || editingDetails || !data?.customer?.name) {
          await invoke("providerBillingOps", { action: "save_details", ...scope, ...profile });
          if (!mounted.current) return;
        }
        if (action === "save") { setEditingDetails(false); setNotice("Datele au fost salvate pentru facturile viitoare."); setTick(t => t + 1); return; }
      }
      const name = action === "checkout" ? "createProviderCheckoutSession" : "createProviderBillingPortalSession";
      const result = await invoke(name, { ...scope, ...extra, return_base_url: window.location.origin, flow });
      // A location or organization switch remounts this panel. Never redirect a departed one.
      if (mounted.current) window.location.assign(result.url);
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { lock.current = false; if (mounted.current) setBusy(""); }
  }
  async function openContract(offerId) {
    const opened = typeof window.open === "function" ? window.open("", "_blank") : null;
    try {
      const result = await invoke("providerEnterpriseOfferOps", { action: "contract_url", offer_id: offerId });
      if (opened) opened.location.href = result.url; else window.location.assign(result.url);
    } catch (err) { opened?.close?.(); if (mounted.current) setError(err.message); }
  }
  if (!locationId && !organizationId) return <p className="text-sm text-muted-foreground">Alege o organizație pentru facturare.</p>;
  const organizationScope = data?.scope === "organization";
  const subscription = data?.subscription;
  const existing = subscription && !["canceled","incomplete_expired"].includes(subscription.status);
  const manual = !existing && data?.manual;
  const legacy = data?.legacy_subscriptions || [];
  // 2026-10-08 (audit plan Free, F2): abonamentele vechi pe locație deja încheiate; facturile lor
  // rămân în Stripe, în contul locației, și se deschid de aici.
  const legacyDocuments = data?.legacy_documents || [];
  const pricing = data?.pricing || {};
  const activeCount = pricing.active_location_count || 0;
  const enterpriseRequired = organizationScope && pricing.enterprise_required === true;
  const openOffers = (data?.enterprise_offers || []).filter(offer => offer.status === "sent");
  const canStartCheckout = !existing && !manual && !legacy.length && !enterpriseRequired && (!organizationScope || activeCount > 0);
  // F6: fără locații active plata nu poate porni; trimitem la Locații, unde se cere redeschiderea.
  const noActiveLocations = organizationScope && !existing && !manual && !legacy.length && !activeCount;
  const locationsHref = (() => { const next = new URLSearchParams(params); next.set("s", "locations"); ["tab", "billing", "session_id"].forEach(key => next.delete(key)); return `/contul-meu?${next.toString()}`; })();
  // Cât timp plata se face încă pe locație, cardul, datele și facturile rămân la abonamentul vechi.
  const legacyOnly = organizationScope && legacy.length > 0 && !data?.customer;
  const problem = ["past_due","unpaid","incomplete","paused","configuration_review"].includes(subscription?.status);
  const address = profile.billing_address;
  const tierLabel = subscription?.plan_tier === "enterprise" ? "Enterprise" : (pricing.tiers || []).find(tier => tier.key === subscription?.plan_tier)?.label;
  const planTitle = subscription?.status === "configuration_review" ? "Abonament de verificat"
    : existing ? `VIASEE Pro${tierLabel ? ` · ${tierLabel}` : ""}` : manual ? "VIASEE Pro" : legacy.length ? "VIASEE Pro · abonament pe locație" : "VIASEE Free";
  // Start a new edit from the latest server snapshot, including portal changes.
  // Repeated activation while already editing must preserve unsaved input.
  const beginEditing = () => {
    if (!editingDetails) setProfile(profileFrom(data?.customer || data?.customer_suggestion));
    setEditingDetails(true);
  };
  const update = (key, value) => setProfile(p => ({ ...p, [key]: value }));
  const updateAddress = (key, value) => setProfile(p => ({ ...p, billing_address: { ...p.billing_address, [key]: value } }));
  const planDescription = () => {
    if (manual) return "Acest acces nu este un abonament plătit prin Stripe.";
    if (!organizationScope) return `Pro: ${money(pricing.amount, pricing.currency)} / ${pricing.interval === "year" ? "an" : "lună"}, pentru această locație. Emitent neplătitor de TVA. Totalul final apare înainte de plată.`;
    if (existing && subscription.plan_tier === "enterprise") return `Ofertă Enterprise: ${money(subscription.amount, pricing.currency)} / lună, pentru toată organizația. Emitent neplătitor de TVA.`;
    if (existing) return `${money(subscription.amount, pricing.currency)} / lună pentru ${locationsLabel(subscription.billed_location_count || activeCount)}. Când adaugi sau închizi o locație, pachetul se schimbă automat, iar diferența apare pe factura următoare. Emitent neplătitor de TVA.`;
    if (legacy.length) return "Acum plătești separat pentru fiecare locație. Pachetele de mai jos se aplică după trecerea la plata pe organizație.";
    if (!activeCount) return `Organizația nu are încă locații active. Pachetul se alege după numărul de locații active, de la ${money(pricing.tiers?.[0]?.amount, pricing.currency)} / lună.`;
    if (enterpriseRequired) return `Organizația are ${locationsLabel(activeCount)}. Peste ${(pricing.enterprise_min_locations || 16) - 1} locații abonamentul se face printr-o ofertă Enterprise, cu contract.`;
    return `Organizația are ${locationsLabel(activeCount)}: pachetul ${pricing.current_tier?.label || ""}, ${money(pricing.current_tier?.amount, pricing.currency)} / lună pentru toată organizația. Emitent neplătitor de TVA. Totalul final apare înainte de plată.`;
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-semibold tracking-tight">Abonament și facturare</h2><p className="mt-1 text-sm text-muted-foreground">{organizationScope ? `Un singur abonament pentru toată organizația ${data?.organization?.name || ""}.` : "Plăți și documente pentru locația selectată."}</p></div><button type="button" className={button} disabled={loading || Boolean(busy)} onClick={() => setTick(t => t + 1)}><RefreshCw className="h-4 w-4" />Actualizează</button></div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" className="ml-3 underline" disabled={loading} onClick={() => setTick(t => t + 1)}>Reîncearcă verificarea</button></div>}
    {notice && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{notice}</p>}
    {loading && <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se verifică datele de facturare…</p>}
    {data && !loading && <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={organizationScope ? "Planul organizației" : "Planul locației"} icon={ShieldCheck} tone="green">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-2xl tracking-tight sm:text-3xl">{planTitle}</strong>{subscription && <BillingStatus status={subscription.status} />}{manual && <span className="text-xs text-muted-foreground">Acordat de VIASEE</span>}</div>
          <p className="mt-2 text-sm text-muted-foreground">{planDescription()}</p>
          {existing && <p className="mt-3 text-sm">{subscription.cancel_at_period_end ? "Acces până la " : "Sfârșitul perioadei curente: "}{date(subscription.end)}{subscription.cancel_at_period_end && ". Reînnoirea este oprită."}</p>}
          {problem && <p className="mt-3 text-sm text-red-800">{subscription?.status === "configuration_review" ? "Configurația abonamentului necesită verificarea VIASEE. Contactează echipa înainte de a încerca o altă plată." : "Abonamentul necesită atenție. Verifică factura restantă și metoda de plată."}</p>}
          {noActiveLocations && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#d8d2c5] bg-[#f8f4ec] p-3 text-sm"><span>Ca să activezi Pro, organizația are nevoie de cel puțin o locație activă.</span><a className={button} href={locationsHref}>Vezi locațiile</a></div>}
          {organizationScope && !existing && !manual && <PlanTiers pricing={pricing} />}
          {legacy.length > 0 && <div className="mt-4 rounded-2xl border border-[#d8d2c5] bg-[#f8f4ec] p-3 text-sm">
            <p className="font-medium">Abonament plătit pe locație (vechiul mod de plată)</p>
            <ul className="mt-2 space-y-2">{legacy.map(item => <li key={item.location_id} className="flex flex-wrap items-center justify-between gap-2"><span>{item.location_name}{item.current_period_end ? ` · ${item.cancel_at_period_end ? "acces până la" : "reînnoire pe"} ${date(item.current_period_end)}` : ""}</span><button type="button" className={button} disabled={Boolean(busy)} onClick={() => void run("portal", undefined, { legacy_location_id: item.location_id })}>Gestionează abonamentul <ExternalLink className="h-4 w-4" /></button></li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">Rămâne valabil cum este. Cardul, datele de facturare și facturile lui le găsești în „Gestionează abonamentul”. Trecerea la plata pe organizație o facem împreună, fără să plătești de două ori.</p>
          </div>}
          <div className="mt-4">{existing ? <button className={button} disabled={Boolean(busy)} onClick={() => void run("portal")}>Gestionează abonamentul <ExternalLink className="h-4 w-4" /></button>
            : enterpriseRequired && !openOffers.length ? <a className={SETTINGS_PRIMARY} href="/ajutor-si-suport">Cere ofertă Enterprise</a>
            : canStartCheckout && <a className={SETTINGS_PRIMARY} href="#billing-details" onClick={beginEditing}>Activează Pro — verifică datele</a>}</div>
        </Panel>
        <Panel title="Metode de plată" icon={CreditCard}>
          {data.methods.length ? <ul className="space-y-3">{data.methods.map(card => <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c6d3da] bg-[#dce5e9]/35 p-3"><div><p className="font-medium"><span className="uppercase">{card.brand}</span> •••• {card.last4}</p><p className="text-xs text-muted-foreground">Expiră {card.exp_month}/{card.exp_year}</p></div>{card.is_default && <span className="text-xs text-muted-foreground">Implicit pentru abonament</span>}</li>)}</ul> : <p className="text-sm text-muted-foreground">{legacyOnly ? "Cardul folosit acum se schimbă din „Gestionează abonamentul”, la abonamentul plătit pe locație." : "Nu există un card salvat. Cardul este adăugat în pagina securizată Stripe."}</p>}
          {data.customer && <div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={Boolean(busy)} onClick={() => void run("portal", "payment_method_update")}>Adaugă / schimbă cardul</button><button className={button} disabled={Boolean(busy)} onClick={() => void run("portal")}>Gestionează cardurile</button></div>}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Adăugarea, înlocuirea și eliminarea cardurilor se fac în Stripe. Pentru un abonament activ poate fi necesară o metodă de plată înlocuitoare.</p>
        </Panel>
      </div>
      {openOffers.length > 0 && <Panel title="Ofertă VIASEE Enterprise" icon={FileText} tone="amber">
        <div className="space-y-4">{openOffers.map(offer => <div key={offer.id} className="rounded-2xl border border-[#e3d3b0] bg-[#fdf8ec] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><strong className="text-2xl tracking-tight">{money(offer.monthly_amount, offer.currency)} / lună</strong>{offer.expires_at && <span className="text-xs text-muted-foreground">Valabilă până la {date(offer.expires_at)}</span>}</div>
          <p className="mt-1 text-sm text-muted-foreground">Pentru toată organizația, indiferent de numărul de locații. După ce accepți contractul, plătești o singură dată cu cardul; suma se încasează apoi automat în fiecare lună.</p>
          {offer.note && <p className="mt-2 whitespace-pre-line text-sm">{offer.note}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={button} onClick={() => void openContract(offer.id)}><FileText className="h-4 w-4" />Citește contractul ({offer.contract_file_name})</button>
          </div>
          <label htmlFor={`offer-accept-${offer.id}`} className="mt-3 flex items-start gap-2 text-sm"><input id={`offer-accept-${offer.id}`} type="checkbox" className="mt-1" checked={acceptedOffers[offer.id] === true} onChange={event => setAcceptedOffers(current => ({ ...current, [offer.id]: event.target.checked }))} />Am citit și accept contractul.</label>
          {!data.customer?.name && <p className="mt-2 text-xs text-muted-foreground">Completează întâi datele de facturare de mai jos.</p>}
          <button type="button" className={`${SETTINGS_PRIMARY} mt-3`} disabled={Boolean(busy) || existing || acceptedOffers[offer.id] !== true || (!data.customer?.name && !editingDetails)} onClick={() => void run("checkout", undefined, { offer_id: offer.id, contract_accepted: true })}>{busy === `offer:${offer.id}` && <Loader2 className="h-4 w-4 animate-spin" />}Accept și plătesc cu cardul</button>
          {existing && <p className="mt-2 text-xs text-muted-foreground">Organizația are deja un abonament. Contactează VIASEE pentru trecerea la oferta Enterprise.</p>}
        </div>)}</div>
      </Panel>}
      <div id="billing-details" className="scroll-mt-24"><Panel title="Date de facturare" icon={FileText} tone="lavender">
        {legacyOnly ? <div className="space-y-3">
          {data.customer_suggestion && <CustomerSummary customer={data.customer_suggestion} />}
          <p className="text-xs leading-relaxed text-muted-foreground">{data.customer_suggestion ? "Acestea sunt datele de pe abonamentul plătit pe locație. " : ""}Le modifici din „Gestionează abonamentul”. La trecerea la plata pe organizație le vei găsi deja completate.</p>
        </div> : !editingDetails && data.customer ? <div className="flex flex-wrap items-start justify-between gap-3">
          <CustomerSummary customer={data.customer} />
          <button type="button" className={button} onClick={beginEditing}>Modifică datele</button>
        </div> : <form onSubmit={event => { event.preventDefault(); void run("save"); }} className="space-y-4">
          <fieldset disabled={Boolean(busy)}><legend className="mb-2 text-sm font-medium">Facturez pe</legend><div className="flex gap-5">{[["company","Firmă"],["individual","Persoană fizică"]].map(([value,label]) => <label key={value} className="flex items-center gap-2 text-sm"><input type="radio" name="billing-type" value={value} checked={profile.billing_type === value} onChange={() => update("billing_type",value)} />{label}</label>)}</div></fieldset>
          <fieldset disabled={Boolean(busy)} className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">{profile.billing_type === "company" ? "Denumire firmă" : "Nume complet"}<input required autoComplete={profile.billing_type === "company" ? "organization" : "name"} className={field} value={profile.billing_name} onChange={e => update("billing_name",e.target.value)} /></label>
            <label className="text-sm">Email pentru facturare<input required type="email" autoComplete="email" className={field} value={profile.billing_email} onChange={e => update("billing_email",e.target.value)} /></label>
            {profile.billing_type === "company" && <label className="text-sm">CUI<input required inputMode="numeric" className={field} placeholder="Ex. 12345678" value={profile.billing_cui} onChange={e => update("billing_cui",e.target.value)} /><span className="mt-1 block text-xs text-muted-foreground">Codul de TVA, dacă există, se adaugă separat în Stripe.</span></label>}
            <label className="text-sm">Adresă<input required autoComplete="street-address" className={field} value={address.line1} onChange={e => updateAddress("line1",e.target.value)} /></label>
            {[["city","Localitate",true],["state","Județ / Regiune",false],["postal_code","Cod poștal",false],["country","Țară (cod de două litere)",true]].map(([key,label,required]) => <label key={key} className="text-sm">{label}<input required={required} maxLength={key === "country" ? 2 : 150} className={field} value={address[key]} onChange={e => updateAddress(key,e.target.value)} /></label>)}
          </fieldset>
          {!data.customer && data.customer_suggestion && <p className="text-xs text-muted-foreground">Am completat datele din vechiul abonament pe locație. Verifică-le înainte să le salvezi pentru organizație.</p>}
          {data.customer?.tax_ids?.length > 0 && <p className="text-xs text-muted-foreground">Coduri fiscale salvate pentru client: {data.customer.tax_ids.map(tax => tax.value).join(", ")}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">Modificările se aplică facturilor viitoare. Pentru corectarea unei facturi deja emise, contactează VIASEE.</p>
          <div className="flex flex-wrap gap-2"><button type="submit" className={button} disabled={Boolean(busy)}>{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Salvează datele</button>
            {(organizationScope ? canStartCheckout : !existing && !manual) && <button type="button" className={SETTINGS_PRIMARY} disabled={Boolean(busy) || !data.pricing?.active} onClick={event => { if (event.currentTarget.form.reportValidity()) void run("checkout"); }}>{busy === "checkout" && <Loader2 className="h-4 w-4 animate-spin" />}Salvează și continuă la plata Pro</button>}
            {data.customer?.name && <button type="button" className={button} disabled={Boolean(busy)} onClick={() => { setProfile(profileFrom(data.customer)); setEditingDetails(false); }}>Renunță la modificări</button>}
            {data.customer && profile.billing_type === "company" && <button type="button" className={button} disabled={Boolean(busy)} onClick={() => void run("portal")}>Gestionează codul TVA</button>}
          </div>
        </form>}
      </Panel></div>
      <Panel title="Istoric plăți și documente Stripe" icon={FileText} tone="amber">
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">Factura fiscală pentru abonament se emite separat. Mai jos găsești documentele Stripe asociate plăților.{legacyOnly ? " Documentele abonamentului plătit pe locație sunt în „Gestionează abonamentul”." : ""}</p>
        <InvoiceTable invoices={data.invoices} />
        {legacyDocuments.length > 0 && <div className="mt-4 rounded-2xl border border-[#d8d2c5] bg-[#f8f4ec] p-3 text-sm">
          <p className="font-medium">Documentele vechiului abonament pe locație</p>
          <ul className="mt-2 space-y-2">{legacyDocuments.map(item => <li key={item.location_id} className="flex flex-wrap items-center justify-between gap-2"><span>{item.location_name}{item.ended_at ? ` · încheiat pe ${date(item.ended_at)}` : ""}</span><button type="button" className={button} disabled={Boolean(busy)} onClick={() => void run("portal", undefined, { legacy_location_id: item.location_id })}>Vezi documentele <ExternalLink className="h-4 w-4" /></button></li>)}</ul>
          <p className="mt-2 text-xs text-muted-foreground">Se deschid în Stripe, în contul vechiului abonament al locației.</p>
        </div>}
        {(page > 0 || data.has_more) && <div className="mt-4 flex items-center justify-between gap-2"><button className={button} disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Mai recente</button><span className="text-xs text-muted-foreground">Pagina {page + 1}</span><button className={button} disabled={!data.has_more || loading} onClick={() => { setCursors(c => [...c.slice(0,page + 1), data.next_cursor]); setPage(p => p + 1); }}>Mai vechi</button></div>}
      </Panel>
    </>}
  </div>;
}
