import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import OutreachAudienceBuilder from "./OutreachAudienceBuilder";
import { CONTACT_STATUS_LABELS, contactStatusTone } from "./outreachLabels";

// Rezultatul verificării DNS (MX) a domeniului, făcută la sincronizare și înainte de trimitere.
const DOMAIN_PROBLEM_LABELS = {
  domain_missing: "Domeniul nu mai există",
  no_mail_server: "Domeniul nu primește email",
  dns_error: "DNS-ul domeniului dă eroare",
};
const UNDELIVERABLE_DOMAIN = ["domain_missing", "no_mail_server"];

const EMPTY_FILTERS = { target_counties: [], target_provider_types: [], target_profile_control_status: [], target_tags: [], target_email_scope: [] };

const PAGE_SIZE = 100;
const LOAD_LIMIT = 2000;

// Distribuția contactelor pe cele trei dimensiuni puse automat la materializare. Grupată pe
// prefix, ca să se citească „ce tipuri am” / „cât de mari sunt rețelele” dintr-o privire.
const TAG_GROUPS = [
  { prefix: "tip:", title: "După tip" },
  { prefix: "retea:", title: "După mărimea rețelei" },
  { prefix: "profil:", title: "După starea profilului" },
  { prefix: "adresa:", title: "A cui e adresa" },
];

const TAG_LABELS = {
  "tip:optica": "Optică medicală",
  "tip:clinica": "Clinică oftalmologică",
  "tip:cabinet-oftalmologic": "Cabinet oftalmologic",
  "tip:cabinet-optometric": "Cabinet optometric",
  "tip:laborator": "Laborator optic",
  "tip:optometrist": "Optometrist independent",
  "tip:medic-oftalmolog": "Medic oftalmolog independent",
  "tip:necunoscut": "Tip necompletat",
  "retea:locatie-unica": "O singură locație",
  "retea:grup-mic": "Grup mic (2-4 locații)",
  "retea:lant": "Lanț (5+ locații)",
  "profil:directory": "Nerevendicat",
  "profil:claimed": "Revendicat",
  "profil:verified": "Verificat",
  "profil:suspended": "Suspendat",
  "adresa:locatie": "Adresa unei singure locații",
  "adresa:organizatie": "Adresa de organizație (mai multe locații)",
};

function TagBreakdown({ breakdown }) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg bg-secondary/60 p-3 sm:grid-cols-3">
      {TAG_GROUPS.map(({ prefix, title }) => {
        const rows = Object.entries(breakdown)
          .filter(([tag]) => tag.startsWith(prefix))
          .sort((a, b) => b[1] - a[1]);
        if (!rows.length) return null;
        return (
          <div key={prefix}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <ul className="mt-1 space-y-0.5">
              {rows.map(([tag, count]) => (
                <li key={tag} className="flex items-baseline justify-between gap-3 text-xs text-foreground">
                  <span>{TAG_LABELS[tag] || tag}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function OutreachContactsList() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const [syncFilters, setSyncFilters] = useState(EMPTY_FILTERS);
  const [accountSync, setAccountSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await base44.entities.OutreachContact.list("-created_date", LOAD_LIMIT);
      setContacts(rows || []);
    } catch (err) {
      setError(err?.message || "Nu am putut încărca contactele.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Numerele de pe filtre se calculează pe toate contactele încărcate, înainte de filtrul de stare.
  const baseFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (scopeFilter && (contact.email_scope || "location") !== scopeFilter) return false;
      if (kindFilter && (contact.contact_kind || "directory") !== kindFilter) return false;
      if (!term) return true;
      return [contact.company_name, contact.email, contact.city, contact.county]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [contacts, search, scopeFilter, kindFilter]);

  const statusCounts = useMemo(() => {
    const counts = { all: baseFiltered.length, __domain_problem: 0 };
    for (const contact of baseFiltered) {
      counts[contact.status] = (counts[contact.status] || 0) + 1;
      if (DOMAIN_PROBLEM_LABELS[contact.email_domain_status]) counts.__domain_problem += 1;
    }
    return counts;
  }, [baseFiltered]);

  const filtered = useMemo(() => baseFiltered.filter((contact) => {
    if (statusFilter === "__domain_problem") return Boolean(DOMAIN_PROBLEM_LABELS[contact.email_domain_status]);
    return !statusFilter || contact.status === statusFilter;
  }), [baseFiltered, statusFilter]);

  const statusChips = [
    { key: "", label: "Toate", count: statusCounts.all },
    ...Object.entries(CONTACT_STATUS_LABELS)
      .filter(([value]) => statusCounts[value] > 0 || value === statusFilter)
      .map(([value, label]) => ({ key: value, label, count: statusCounts[value] || 0 })),
    ...(statusCounts.__domain_problem > 0 || statusFilter === "__domain_problem"
      ? [{ key: "__domain_problem", label: "Probleme de domeniu", count: statusCounts.__domain_problem }]
      : []),
  ];

  const runSync = async () => {
    setSyncing(true);
    setSyncSummary(null);
    setError("");
    let cursor = 0;
    let hasMore = true;
    const totals = { created: 0, updated: 0, unchanged: 0, skipped: 0, undeliverable: 0, dnsErrors: 0 };
    const payload = {
      action: "sync_contacts_from_directory",
      target_counties: syncFilters.target_counties,
      target_provider_types: syncFilters.target_provider_types,
      target_profile_control_status: syncFilters.target_profile_control_status,
    };
    // Un lot care cade (timeout, limita de cereri) se reîncearcă de două ori înainte să oprim.
    // Sincronizarea e idempotentă, deci reluarea aceluiași lot nu dublează nimic.
    const invokeChunk = async (chunkCursor) => {
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await base44.functions.invoke("outreachCampaignOps", { ...payload, cursor: chunkCursor });
          return response.data || {};
        } catch (err) {
          lastError = err;
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }
      throw lastError;
    };
    try {
      while (hasMore) {
        const data = await invokeChunk(cursor);
        if (data.error) { setError(data.error); break; }
        totals.created += data.created || 0;
        totals.updated += data.updated || 0;
        totals.unchanged += data.unchanged || 0;
        totals.skipped += data.skipped || 0;
        totals.undeliverable += data.undeliverable_domains || 0;
        totals.dnsErrors += data.dns_error_domains || 0;
        cursor = data.next_cursor || cursor;
        hasMore = !!data.has_more;
        setSyncSummary({
          ...totals,
          done: !hasMore,
          processed: cursor,
          breakdown: data.breakdown || null,
          total: data.total_candidates || 0,
          uniqueEmails: data.unique_emails || 0,
        });
      }
    } catch (err) {
      setError(`Sincronizarea s-a oprit la ${cursor} adrese. Apasă din nou: continuă fără dubluri. (${err.response?.data?.error || err.message})`);
    }
    // După director, furnizorii cu cont (utilizatorii cu acces activ la o organizație): puțini,
    // într-un singur apel.
    try {
      const response = await base44.functions.invoke("outreachCampaignOps", { action: "sync_provider_accounts" });
      setAccountSync(response.data || null);
    } catch (err) {
      setAccountSync({ error: err.response?.data?.error || err.message });
    }
    setSyncing(false);
    load();
  };

  const page = filtered.slice(0, shown);
  const selectClass = "min-h-10 rounded-xl border border-input bg-card px-3 text-base sm:text-xs";

  return (
    <div className="space-y-5">
      <details className="group rounded-2xl border border-border bg-card" open={Boolean(syncSummary) || syncing}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">Pregătește contacte din director</span>
            <AdminHint label="Ce face sincronizarea">
              Creează sau actualizează contacte din locațiile publicate care au o adresă publică de contact, completând automat temeiul legal și proveniența din datele locației. Lanțurile cu aceeași adresă pe mai multe locații devin un singur contact.
            </AdminHint>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">
          <OutreachAudienceBuilder filters={syncFilters} onChange={setSyncFilters} disabled={syncing} hideContactOnlyFilters />
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-60 sm:min-h-10"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            {syncing ? "Se sincronizează…" : "Sincronizează acum"}
          </button>
          {syncSummary && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {syncSummary.created} create, {syncSummary.updated} actualizate, {syncSummary.unchanged} neschimbate, {syncSummary.skipped} sărite
                {syncSummary.done
                  ? ` — finalizat: ${syncSummary.total} locații publicate cu email, ${syncSummary.uniqueEmails} adrese unice.`
                  : ` — în curs: ${syncSummary.processed} din ${syncSummary.uniqueEmails} adrese…`}
              </p>
              {(syncSummary.undeliverable > 0 || syncSummary.dnsErrors > 0) && (
                <AdminNotice tone="warning">
                  {syncSummary.undeliverable > 0 && `${syncSummary.undeliverable} adrese sunt pe domenii care nu pot primi email și nu vor primi campanii. `}
                  {syncSummary.dnsErrors > 0 && `${syncSummary.dnsErrors} domenii au răspuns cu eroare DNS; se reverifică înainte de trimitere. `}
                  Le găsești cu filtrul „Probleme de domeniu”.
                </AdminNotice>
              )}
              {accountSync && (
                <p className="text-xs text-muted-foreground">
                  {accountSync.error
                    ? `Furnizorii cu cont nu s-au putut sincroniza: ${accountSync.error}`
                    : `Furnizori cu cont: ${accountSync.active_accounts} activi (${accountSync.created} noi, ${accountSync.updated} actualizați${accountSync.deactivated ? `, ${accountSync.deactivated} fără acces activ` : ""}).`}
                </p>
              )}
              {syncSummary.breakdown && <TagBreakdown breakdown={syncSummary.breakdown} />}
            </div>
          )}
        </div>
      </details>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">
            Contacte <span className="font-normal text-muted-foreground">({filtered.length}{filtered.length !== contacts.length ? ` din ${contacts.length}` : ""})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-input bg-card px-3">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Caută firmă, email, oraș…"
                aria-label="Caută contacte"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShown(PAGE_SIZE); }}
                className="w-44 bg-transparent text-base outline-none sm:text-xs"
              />
            </label>
            <select value={kindFilter} onChange={(e) => { setKindFilter(e.target.value); setShown(PAGE_SIZE); }} className={selectClass} aria-label="Sursa contactului">
              <option value="">Toate sursele</option>
              <option value="directory">Din director</option>
              <option value="provider_account">Furnizori cu cont</option>
            </select>
            <select value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setShown(PAGE_SIZE); }} className={selectClass} aria-label="Tipul adresei">
              <option value="">Toate adresele</option>
              <option value="location">Adrese de locație</option>
              <option value="organization">Adrese de organizație</option>
            </select>
            <button type="button" onClick={load} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Reîncarcă
            </button>
          </div>
        </div>

        {contacts.length > 0 && (
          <AdminChips className="mt-3" options={statusChips} value={statusFilter} onChange={(key) => { setStatusFilter(key); setShown(PAGE_SIZE); }} label="Filtrează după stare" />
        )}

        {error && <AdminNotice tone="danger" className="mt-3">{error}</AdminNotice>}
        {contacts.length >= LOAD_LIMIT && (
          <AdminNotice tone="warning" className="mt-3">Sunt încărcate primele {LOAD_LIMIT.toLocaleString("ro-RO")} de contacte; pot exista mai multe.</AdminNotice>
        )}
        {loading ? (
          <div className="mt-4"><AdminLoading label="Se încarcă contactele…" rows={3} /></div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Firmă</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Localitate</th>
                  <th className="px-3 py-2">Stare</th>
                  <th className="px-3 py-2">Temei legal</th>
                </tr>
              </thead>
              <tbody>
                {page.map((contact) => (
                  <tr key={contact.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {contact.company_name || "—"}
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {contact.contact_kind === "provider_account" && (
                          <StatusBadge
                            label={`${contact.account_active === false ? "Cont inactiv" : "Cont furnizor"}${contact.contact_name ? ` · ${contact.contact_name}` : ""}`}
                            tone={contact.account_active === false ? "neutral" : "info"}
                          />
                        )}
                        {Array.isArray(contact.unsubscribed_categories) && contact.unsubscribed_categories.length > 0 && (
                          <StatusBadge
                            label={`Dezabonat: ${contact.unsubscribed_categories.map((c) => (c === "announcement" ? "anunțuri" : "marketing")).join(", ")}`}
                            tone="warning"
                          />
                        )}
                        {contact.contact_kind !== "provider_account" && contact.email_scope === "organization" && (
                          <span title="Aceeași adresă e folosită de mai multe locații din director">
                            <StatusBadge
                              label={`Organizație · ${contact.shared_location_count || "?"} locații${(contact.shared_city_count || 0) > 1 ? ` · ${contact.shared_city_count} orașe` : ""}`}
                            />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {contact.email}
                      {DOMAIN_PROBLEM_LABELS[contact.email_domain_status] && (
                        <span
                          className="ml-2 align-middle"
                          title={UNDELIVERABLE_DOMAIN.includes(contact.email_domain_status) ? "Nu se trimite la această adresă: ar fi respinsă sigur." : "Se reverifică înainte de fiecare trimitere."}
                        >
                          <StatusBadge
                            label={DOMAIN_PROBLEM_LABELS[contact.email_domain_status]}
                            tone={UNDELIVERABLE_DOMAIN.includes(contact.email_domain_status) ? "danger" : "warning"}
                          />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{[contact.city, contact.county].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={CONTACT_STATUS_LABELS[contact.status] || contact.status} tone={contactStatusTone(contact.status)} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{contact.lawful_basis || "—"}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Niciun contact.</td></tr>
                )}
              </tbody>
            </table>
            {filtered.length > shown && (
              <div className="border-t border-border p-3 text-center">
                <button
                  type="button"
                  onClick={() => setShown((current) => current + PAGE_SIZE)}
                  className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs font-semibold hover:bg-secondary"
                >
                  Arată încă {Math.min(PAGE_SIZE, filtered.length - shown)} din {filtered.length - shown}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
