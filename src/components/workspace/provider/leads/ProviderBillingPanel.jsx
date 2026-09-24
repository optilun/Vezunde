import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CreditCard, FileText, Loader2, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { SETTINGS_GRAIN, SETTINGS_TONES, SETTINGS_BUTTON, SETTINGS_PRIMARY } from "../settingsVisuals";

export const money = (amount, currency = "ron") => amount == null ? "—" : new Intl.NumberFormat("ro-RO", { style: "currency", currency }).format(amount / 100);
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
    <thead className="bg-[#f1ecdf] text-xs text-[#665b4a]"><tr>{["Dată / Factură","Stare","Total","Rest de plată","Document"].map(t => <th key={t} className="border-b border-border px-2 py-3 font-medium">{t}</th>)}</tr></thead>
    <tbody>{invoices.map(invoice => <tr key={invoice.id} className="border-b border-border transition hover:bg-[#f8f4ec] last:border-0">
      <td className="px-2 py-4">{date(invoice.created)}<p className="text-xs text-muted-foreground">{invoice.number || "Număr nealocat"}</p></td>
      <td className="px-2 py-4"><BillingStatus status={invoice.status} />{invoice.status === "open" && invoice.attempted && <p className="mt-1 text-xs text-muted-foreground">{invoice.attempt_count} încercări de încasare</p>}</td>
      <td className="px-2 py-4">{money(invoice.total, invoice.currency)}</td><td className="px-2 py-4">{money(invoice.amount_remaining, invoice.currency)}</td>
      <td className="px-2 py-4"><div className="flex gap-3">{invoice.hosted_invoice_url && <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{invoice.status === "open" ? "Vezi / plătește" : "Vezi"}</a>}{invoice.invoice_pdf && <a href={invoice.invoice_pdf} target="_blank" rel="noreferrer" className="underline underline-offset-4" aria-label={`Descarcă factura ${invoice.number || ""} PDF`}>PDF Stripe</a>}</div></td>
    </tr>)}</tbody>
  </table></div>;
}
export default function ProviderBillingPanel(props) {
  return <BillingCenter key={props.locationId} {...props} />;
}
function BillingCenter({ locationId, onSynced }) {
  const [params, setParams] = useSearchParams();
  const billing = params.get("billing"), sessionId = params.get("session_id");
  const [data, setData] = useState(null), [profile, setProfile] = useState(profileFrom(null));
  const [editingDetails, setEditingDetails] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true), [tick, setTick] = useState(0);
  const [cursors, setCursors] = useState([null]), [page, setPage] = useState(0);
  const lock = useRef(false), sequence = useRef(0), synced = useRef(onSynced);
  const profileInitialized = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  synced.current = onSynced;
  const cursor = cursors[page];
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setError("");
    try {
      if (billing === "success" || billing === "portal_return") {
        await invoke("syncProviderStripeSubscription", { location_id: locationId, session_id: sessionId || undefined });
      }
      const result = await invoke("providerBillingOps", { location_id: locationId, cursor });
      if (request !== sequence.current) return;
      setData(result);
      // Invoice pagination and retries must not overwrite an unsaved billing form.
      if (!profileInitialized.current) { setProfile(profileFrom(result.customer)); setEditingDetails(!result.customer?.name); profileInitialized.current = true; }
      synced.current?.();
      if (billing === "success" || billing === "portal_return") {
        setNotice(billing === "success" ? "Starea abonamentului a fost verificată cu Stripe." : "Datele de plată au fost actualizate.");
        // Keep return parameters until both confirmation and reload have succeeded.
        setParams(current => { const next = new URLSearchParams(current); next.delete("billing"); next.delete("session_id"); return next; }, { replace: true });
      } else if (billing === "cancelled") {
        setNotice("Ai închis plata. Poți relua activarea Pro când dorești.");
      }
    } catch (err) { if (request === sequence.current) setError(err.message); }
    finally { if (request === sequence.current) setLoading(false); }
  }, [billing, sessionId, locationId, cursor, setParams]);
  useEffect(() => { if (locationId) void load(); return () => { sequence.current++; }; }, [load, locationId, tick]);
  async function run(action, flow) {
    if (lock.current || !mounted.current) return;
    lock.current = true; setBusy(action); setError(""); setNotice("");
    try {
      if (action === "save" || action === "checkout") {
        await invoke("providerBillingOps", { action: "save_details", location_id: locationId, ...profile });
        if (!mounted.current) return;
        if (action === "save") { setEditingDetails(false); setNotice("Datele au fost salvate pentru facturile viitoare."); setTick(t => t + 1); return; }
      }
      const name = action === "checkout" ? "createProviderCheckoutSession" : "createProviderBillingPortalSession";
      const result = await invoke(name, { location_id: locationId, return_base_url: window.location.origin, flow });
      // A location switch remounts this panel. Never redirect a departed location.
      if (mounted.current) window.location.assign(result.url);
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { lock.current = false; if (mounted.current) setBusy(""); }
  }
  if (!locationId) return <p className="text-sm text-muted-foreground">Alege o locație pentru facturare.</p>;
  const subscription = data?.subscription;
  const existing = subscription && !["canceled","incomplete_expired"].includes(subscription.status);
  const manual = !existing && data?.manual;
  const problem = ["past_due","unpaid","incomplete","paused","configuration_review"].includes(subscription?.status);
  const address = profile.billing_address;
  // Start a new edit from the latest server snapshot, including portal changes.
  // Repeated activation while already editing must preserve unsaved input.
  const beginEditing = () => {
    if (!editingDetails) setProfile(profileFrom(data?.customer));
    setEditingDetails(true);
  };
  const update = (key, value) => setProfile(p => ({ ...p, [key]: value }));
  const updateAddress = (key, value) => setProfile(p => ({ ...p, billing_address: { ...p.billing_address, [key]: value } }));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-semibold tracking-tight">Abonament și facturare</h2><p className="mt-1 text-sm text-muted-foreground">Plăți și documente pentru locația selectată.</p></div><button type="button" className={button} disabled={loading || Boolean(busy)} onClick={() => setTick(t => t + 1)}><RefreshCw className="h-4 w-4" />Actualizează</button></div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button type="button" className="ml-3 underline" disabled={loading} onClick={() => setTick(t => t + 1)}>Reîncearcă verificarea</button></div>}
    {notice && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{notice}</p>}
    {loading && <p role="status" className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se verifică datele de facturare…</p>}
    {data && !loading && <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Planul locației" icon={ShieldCheck} tone="green">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-2xl tracking-tight sm:text-3xl">{subscription?.status === "configuration_review" ? "Abonament de verificat" : existing || manual ? "VIASEE Pro" : "VIASEE Free"}</strong>{subscription && <BillingStatus status={subscription.status} />}{manual && <span className="text-xs text-muted-foreground">Acordat de VIASEE</span>}</div>
          <p className="mt-2 text-sm text-muted-foreground">{manual ? "Acest acces nu este un abonament plătit prin Stripe." : `Pro: ${money(data.pricing?.amount, data.pricing?.currency)} / ${data.pricing?.interval === "year" ? "an" : "lună"}, pentru această locație. Emitent neplătitor de TVA. Totalul final apare înainte de plată.`}</p>
          {existing && <p className="mt-3 text-sm">{subscription.cancel_at_period_end ? "Acces până la " : "Sfârșitul perioadei curente: "}{date(subscription.end)}{subscription.cancel_at_period_end && ". Reînnoirea este oprită."}</p>}
          {problem && <p className="mt-3 text-sm text-red-800">{subscription?.status === "configuration_review" ? "Configurația abonamentului necesită verificarea VIASEE. Contactează echipa înainte de a încerca o altă plată." : "Abonamentul necesită atenție. Verifică factura restantă și metoda de plată."}</p>}
          <div className="mt-4">{existing ? <button className={button} disabled={Boolean(busy)} onClick={() => void run("portal")}>Gestionează abonamentul <ExternalLink className="h-4 w-4" /></button> : !manual && <a className={SETTINGS_PRIMARY} href="#billing-details" onClick={beginEditing}>Activează Pro — verifică datele</a>}</div>
        </Panel>
        <Panel title="Metode de plată" icon={CreditCard}>
          {data.methods.length ? <ul className="space-y-3">{data.methods.map(card => <li key={card.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c6d3da] bg-[#dce5e9]/35 p-3"><div><p className="font-medium"><span className="uppercase">{card.brand}</span> •••• {card.last4}</p><p className="text-xs text-muted-foreground">Expiră {card.exp_month}/{card.exp_year}</p></div>{card.is_default && <span className="text-xs text-muted-foreground">Implicit pentru abonament</span>}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nu există un card salvat. Cardul este adăugat în pagina securizată Stripe.</p>}
          {data.customer && <div className="mt-4 flex flex-wrap gap-2"><button className={button} disabled={Boolean(busy)} onClick={() => void run("portal", "payment_method_update")}>Adaugă / schimbă cardul</button><button className={button} disabled={Boolean(busy)} onClick={() => void run("portal")}>Gestionează cardurile</button></div>}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Adăugarea, înlocuirea și eliminarea cardurilor se fac în Stripe. Pentru un abonament activ poate fi necesară o metodă de plată înlocuitoare.</p>
        </Panel>
      </div>
      <div id="billing-details" className="scroll-mt-24"><Panel title="Date de facturare" icon={FileText} tone="lavender">
        {!editingDetails && data.customer ? <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 break-words text-sm"><p className="font-medium">{data.customer.name}</p><p className="mt-1 text-muted-foreground">{data.customer.cui ? "CUI " + data.customer.cui + " · " : ""}{data.customer.email}</p><p className="mt-1 text-muted-foreground">{[data.customer.address?.line1, data.customer.address?.city, data.customer.address?.country].filter(Boolean).join(", ")}</p></div>
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
          {data.customer?.tax_ids?.length > 0 && <p className="text-xs text-muted-foreground">Coduri fiscale salvate pentru client: {data.customer.tax_ids.map(tax => tax.value).join(", ")}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">Modificările se aplică facturilor viitoare. Pentru corectarea unei facturi deja emise, contactează VIASEE.</p>
          <div className="flex flex-wrap gap-2"><button type="submit" className={button} disabled={Boolean(busy)}>{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Salvează datele</button>
            {!existing && !manual && <button type="button" className={SETTINGS_PRIMARY} disabled={Boolean(busy) || !data.pricing?.active} onClick={event => { if (event.currentTarget.form.reportValidity()) void run("checkout"); }}>{busy === "checkout" && <Loader2 className="h-4 w-4 animate-spin" />}Salvează și continuă la plata Pro</button>}
            {data.customer?.name && <button type="button" className={button} disabled={Boolean(busy)} onClick={() => { setProfile(profileFrom(data.customer)); setEditingDetails(false); }}>Renunță la modificări</button>}
            {data.customer && profile.billing_type === "company" && <button type="button" className={button} disabled={Boolean(busy)} onClick={() => void run("portal")}>Gestionează codul TVA</button>}
          </div>
        </form>}
      </Panel></div>
      <Panel title="Istoric plăți și documente Stripe" icon={FileText} tone="amber">
        <p className="mb-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">Factura fiscală pentru abonament se emite separat. Mai jos găsești documentele Stripe asociate plăților.</p>
        <InvoiceTable invoices={data.invoices} />
        {(page > 0 || data.has_more) && <div className="mt-4 flex items-center justify-between gap-2"><button className={button} disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Mai recente</button><span className="text-xs text-muted-foreground">Pagina {page + 1}</span><button className={button} disabled={!data.has_more || loading} onClick={() => { setCursors(c => [...c.slice(0,page + 1), data.next_cursor]); setPage(p => p + 1); }}>Mai vechi</button></div>}
      </Panel>
    </>}
  </div>;
}
