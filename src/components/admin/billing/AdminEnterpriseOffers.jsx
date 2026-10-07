import React, { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Search, Send, Upload } from "lucide-react";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import { useAdminConfirm } from "@/components/admin/ui/AdminConfirm";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { enterpriseOfferLabel, enterpriseOfferTone } from "@/lib/adminLabels";

// 2026-10-04 (structura conturilor, pasul 4): ofertele Enterprise. Adminul alege organizația, scrie
// suma lunară și încarcă contractul PDF. Proprietarul organizației vede oferta în facturare, acceptă
// contractul și plătește cu cardul; Stripe încasează apoi automat suma în fiecare lună.
// 2026-10-07: doar aspectul (componente comune, tokeni, text scurt); logica e neschimbată.
const BUTTON = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-50";
const PRIMARY = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-50";
const FIELD = "mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
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
  const confirm = useAdminConfirm();
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
    if (lock.current) return;
    if (!(await confirm({ title: "Retragi această ofertă?", description: "Proprietarul nu o mai poate accepta.", confirmLabel: "Retrage oferta", tone: "danger" }))) return;
    lock.current = true; setError(""); setNotice("");
    try { await call({ action: "admin_cancel", offer_id: offerId }); setNotice("Oferta a fost retrasă."); await load(); }
    catch (err) { setError(err.message); }
    finally { lock.current = false; }
  }

  return (
    <div className="space-y-4">
      {notice && <AdminNotice tone="success" onDismiss={() => setNotice("")}>{notice}</AdminNotice>}
      {error && <AdminNotice tone="danger" onDismiss={() => setError("")}>{error}</AdminNotice>}

      <AdminCard className="p-4 sm:p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-1">
            <h3 className="font-heading text-sm font-bold">Ofertă nouă</h3>
            <AdminHint label="Despre ofertele Enterprise">
              Pentru organizațiile cu peste 15 locații sau cu un preț negociat. Clientul acceptă contractul și plătește cu cardul o singură dată; Stripe încasează apoi automat suma în fiecare lună, pentru toată organizația.
            </AdminHint>
          </div>
          {organization ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/60 p-3 text-sm">
              <span><strong>{organization.name}</strong>{organization.legal_name ? ` · ${organization.legal_name}` : ""} · {organization.active_location_count} locații active</span>
              <button type="button" className="text-xs font-semibold underline underline-offset-2" onClick={() => setOrganization(null)}>Schimbă</button>
            </div>
          ) : (
            <div>
              <label htmlFor="enterprise-org-search" className="text-xs font-semibold">Organizația</label>
              <div className="mt-1 flex gap-2">
                <input id="enterprise-org-search" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută după nume sau ID" onKeyDown={(event) => { if (event.key === "Enter") void search(event); }} />
                <button type="button" className={BUTTON} disabled={searching || query.trim().length < 2} onClick={(event) => void search(event)}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}Caută
                </button>
              </div>
              {results.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
                  {results.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => setOrganization(item)}>
                        <span><strong>{item.name}</strong>{item.legal_name ? ` · ${item.legal_name}` : ""}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.active_location_count} locații active</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">Suma lunară (lei)<input id="enterprise-amount" required inputMode="decimal" className={FIELD} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex. 450" /></label>
            <label className="text-xs font-semibold">Oferta e valabilă (zile)<input id="enterprise-valid-days" inputMode="numeric" className={FIELD} value={validDays} onChange={(event) => setValidDays(event.target.value)} /></label>
          </div>
          <label className="block text-xs font-semibold">Notă pentru client (opțional)
            <textarea id="enterprise-note" rows={3} maxLength={1000} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ce include oferta, persoana de contact etc." />
          </label>
          <label className="block text-xs font-semibold">Contract (PDF)
            <span className="mt-1 flex items-center gap-2 font-normal"><Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" /><input id="enterprise-contract" type="file" accept="application/pdf" required onChange={(event) => setFile(event.target.files?.[0] || null)} className="text-sm" /></span>
            <span className="mt-1 block text-[11px] font-normal text-muted-foreground">Fișierul rămâne privat. Clientul îl deschide din contul lui printr-un link temporar.</span>
          </label>
          <button type="submit" className={PRIMARY} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}Trimite oferta
          </button>
        </form>
      </AdminCard>

      {loading && <AdminLoading label="Se încarcă ofertele…" rows={2} />}
      {!loading && offers.length === 0 && !error && (
        <AdminCard className="p-5"><EmptyState title="Nu există încă oferte Enterprise." subtitle="Ofertele trimise apar aici, cu starea lor." /></AdminCard>
      )}
      {!loading && offers.length > 0 && (
        <div role="region" aria-label="Oferte Enterprise" tabIndex={0} className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground"><tr>{["Organizație", "Sumă / lună", "Stare", "Valabilă până la", "Acțiuni"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} className="border-t border-border align-top">
                  <td className="px-4 py-3"><p className="font-medium">{offer.organization_name}</p><p className="text-xs text-muted-foreground">{offer.contract_file_name} · trimisă {day(offer.created_date)}</p></td>
                  <td className="px-4 py-3">{lei(offer.monthly_amount_ron)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge label={enterpriseOfferLabel(offer.status)} tone={enterpriseOfferTone(offer.status)} />
                    {offer.contract_accepted_at && offer.status === "sent" && <p className="mt-1 text-xs text-muted-foreground">Contract acceptat, plata neconfirmată</p>}
                  </td>
                  <td className="px-4 py-3">{day(offer.expires_at)}</td>
                  <td className="px-4 py-3">{offer.status === "sent" && <button type="button" className="text-xs font-semibold text-danger underline underline-offset-2" onClick={() => void cancel(offer.id)}>Retrage</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
