import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Search, Send, Upload } from "lucide-react";

// 2026-10-04 (structura conturilor, pasul 4): ofertele Enterprise. Adminul alege organizația, scrie
// suma lunară și încarcă contractul PDF. Proprietarul organizației vede oferta în facturare, acceptă
// contractul și plătește cu cardul; Stripe încasează apoi automat suma în fiecare lună.
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50";
const field = "mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm";
const STATUS_LABELS = { sent: "Trimisă", accepted: "Acceptată și plătită", canceled: "Retrasă", superseded: "Înlocuită", expired: "Expirată" };
const lei = (value) => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "ron" }).format(Number(value) || 0);
const day = (value) => (value ? new Date(value).toLocaleDateString("ro-RO") : "—");

async function call(payload) {
  try {
    const response = await base44.functions.invoke("providerEnterpriseOfferOps", payload);
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  } catch (error) { throw new Error(error?.response?.data?.error || error.message || "Operațiunea nu a reușit."); }
}

export default function AdminEnterpriseOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [organization, setOrganization] = useState(null);
  const [amount, setAmount] = useState("");
  const [validDays, setValidDays] = useState("30");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setOffers((await call({ action: "admin_list" })).offers || []); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true); setError("");
    try { setResults((await call({ action: "admin_search_organizations", q: query.trim() })).organizations || []); }
    catch (err) { setError(err.message); }
    finally { setSearching(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!organization) { setError("Alege organizația."); return; }
    if (!file) { setError("Încarcă contractul în PDF."); return; }
    if (file.type && file.type !== "application/pdf") { setError("Contractul trebuie să fie un fișier PDF."); return; }
    lock.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const uploaded = await base44.integrations.Core.UploadPrivateFile({ file });
      if (!uploaded?.file_uri) throw new Error("Contractul nu a putut fi încărcat.");
      const result = await call({
        action: "admin_create",
        organization_id: organization.id,
        monthly_amount_ron: amount,
        valid_days: Number(validDays) || 30,
        note,
        contract_file_uri: uploaded.file_uri,
        contract_file_name: file.name,
        app_base_url: window.location.origin,
      });
      setNotice(`Oferta a fost trimisă. ${result.notified_owner_count ? `Am anunțat ${result.notified_owner_count} ${result.notified_owner_count === 1 ? "proprietar" : "proprietari"} pe email.` : "Proprietarul o vede în contul lui, la facturare."}`);
      setOrganization(null); setAmount(""); setNote(""); setFile(null); setResults([]); setQuery("");
      await load();
    } catch (err) { setError(err.message); }
    finally { lock.current = false; setSaving(false); }
  }

  async function cancel(offerId) {
    if (lock.current || !window.confirm("Retragi această ofertă? Proprietarul nu o mai poate accepta.")) return;
    lock.current = true; setError(""); setNotice("");
    try { await call({ action: "admin_cancel", offer_id: offerId }); setNotice("Oferta a fost retrasă."); await load(); }
    catch (err) { setError(err.message); }
    finally { lock.current = false; }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Pentru organizațiile cu peste 15 locații sau cu un preț negociat. Clientul acceptă contractul și plătește cu cardul o singură dată; Stripe încasează apoi automat suma în fiecare lună, pentru toată organizația.</p>
      {notice && <p role="status" className="rounded-lg bg-secondary p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h3 className="text-base font-semibold">Ofertă nouă</h3>
        {organization ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 p-3 text-sm">
            <span><strong>{organization.name}</strong>{organization.legal_name ? ` · ${organization.legal_name}` : ""} · {organization.active_location_count} locații active</span>
            <button type="button" className="underline" onClick={() => setOrganization(null)}>Schimbă</button>
          </div>
        ) : (
          <div>
            <label htmlFor="enterprise-org-search" className="text-sm font-medium">Organizația</label>
            <div className="mt-1 flex gap-2">
              <input id="enterprise-org-search" className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută după nume sau ID" onKeyDown={(event) => { if (event.key === "Enter") void search(event); }} />
              <button type="button" className={button} disabled={searching || query.trim().length < 2} onClick={(event) => void search(event)}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Caută</button>
            </div>
            {results.length > 0 && <ul className="mt-2 divide-y divide-border rounded-lg border border-border">{results.map((item) => <li key={item.id}><button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => setOrganization(item)}><span><strong>{item.name}</strong>{item.legal_name ? ` · ${item.legal_name}` : ""}</span><span className="text-xs text-muted-foreground">{item.active_location_count} locații active</span></button></li>)}</ul>}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Suma lunară (lei)<input id="enterprise-amount" required inputMode="decimal" className={field} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex. 450" /></label>
          <label className="text-sm">Oferta e valabilă (zile)<input id="enterprise-valid-days" inputMode="numeric" className={field} value={validDays} onChange={(event) => setValidDays(event.target.value)} /></label>
        </div>
        <label className="block text-sm">Notă pentru client (opțional)<textarea id="enterprise-note" rows={3} maxLength={1000} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ce include oferta, persoana de contact etc." /></label>
        <label className="block text-sm">Contract (PDF)
          <span className="mt-1 flex items-center gap-2"><Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><input id="enterprise-contract" type="file" accept="application/pdf" required onChange={(event) => setFile(event.target.files?.[0] || null)} className="text-sm" /></span>
          <span className="mt-1 block text-xs text-muted-foreground">Fișierul rămâne privat. Clientul îl deschide din contul lui printr-un link temporar.</span>
        </label>
        <button type="submit" className={primary} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Trimite oferta</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-secondary text-xs"><tr>{["Organizație", "Sumă / lună", "Stare", "Valabilă până la", "Acțiuni"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>
            {offers.map((offer) => <tr key={offer.id} className="border-t border-border">
              <td className="px-4 py-3"><p className="font-medium">{offer.organization_name}</p><p className="text-xs text-muted-foreground">{offer.contract_file_name} · trimisă {day(offer.created_date)}</p></td>
              <td className="px-4 py-3">{lei(offer.monthly_amount_ron)}</td>
              <td className="px-4 py-3">{STATUS_LABELS[offer.status] || offer.status}{offer.contract_accepted_at && offer.status === "sent" && <p className="text-xs text-muted-foreground">Contract acceptat, plata neconfirmată</p>}</td>
              <td className="px-4 py-3">{day(offer.expires_at)}</td>
              <td className="px-4 py-3">{offer.status === "sent" && <button type="button" className="text-sm font-semibold text-red-700 underline" onClick={() => void cancel(offer.id)}>Retrage</button>}</td>
            </tr>)}
          </tbody>
        </table>
        {loading && <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Se încarcă ofertele…</p>}
        {!loading && !offers.length && <p className="p-4 text-sm text-muted-foreground">Nu există încă oferte Enterprise.</p>}
      </div>
    </div>
  );
}
