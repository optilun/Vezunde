import React, { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import OutreachAudienceBuilder from "./OutreachAudienceBuilder";

const STATUS_LABELS = {
  new: "Nou",
  contacted: "Contactat",
  replied: "A raspuns",
  interested: "Interesat",
  not_interested: "Neinteresat",
  unsubscribed: "Dezabonat",
  converted: "Convertit",
  bounced: "Respins (bounce)",
  invalid: "Invalid",
  complained: "Plangere spam",
};

function statusClass(status) {
  if (status === "unsubscribed" || status === "bounced" || status === "invalid" || status === "complained") return "bg-red-50 text-red-800";
  if (status === "converted" || status === "interested" || status === "replied") return "bg-green-50 text-green-800";
  if (status === "contacted") return "bg-blue-50 text-blue-800";
  return "bg-secondary text-muted-foreground";
}

// Rezultatul verificarii DNS (MX) a domeniului, facuta la sincronizare si inainte de trimitere.
const DOMAIN_PROBLEM_LABELS = {
  domain_missing: "Domeniul nu mai exista",
  no_mail_server: "Domeniul nu primeste email",
  dns_error: "DNS-ul domeniului da eroare",
};
const UNDELIVERABLE_DOMAIN = ["domain_missing", "no_mail_server"];

const EMPTY_FILTERS = { target_counties: [], target_provider_types: [], target_profile_control_status: [], target_tags: [], target_email_scope: [] };

// Distributia contactelor pe cele trei dimensiuni puse automat la materializare. Grupata pe
// prefix, ca sa se citeasca "ce tipuri am" / "cat de mari sunt retelele" dintr-o privire.
const TAG_GROUPS = [
  { prefix: "tip:", title: "Dupa tip" },
  { prefix: "retea:", title: "Dupa marimea retelei" },
  { prefix: "profil:", title: "Dupa starea profilului" },
  { prefix: "adresa:", title: "A cui e adresa" },
];

const TAG_LABELS = {
  "tip:optica": "Optica medicala",
  "tip:clinica": "Clinica oftalmologica",
  "tip:cabinet-oftalmologic": "Cabinet oftalmologic",
  "tip:cabinet-optometric": "Cabinet optometric",
  "tip:laborator": "Laborator optic",
  "tip:optometrist": "Optometrist independent",
  "tip:medic-oftalmolog": "Medic oftalmolog independent",
  "tip:necunoscut": "Tip necompletat",
  "retea:locatie-unica": "O singura locatie",
  "retea:grup-mic": "Grup mic (2-4 locatii)",
  "retea:lant": "Lant (5+ locatii)",
  "profil:directory": "Nerevendicat",
  "profil:claimed": "Revendicat",
  "profil:verified": "Verificat",
  "profil:suspended": "Suspendat",
  "adresa:locatie": "Adresa unei singure locatii",
  "adresa:organizatie": "Adresa de organizatie (mai multe locatii)",
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

  const [syncFilters, setSyncFilters] = useState(EMPTY_FILTERS);
  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await base44.entities.OutreachContact.list("-created_date", 2000);
      setContacts(rows || []);
    } catch (err) {
      setError(err?.message || "Nu am putut incarca contactele.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (statusFilter === "__domain_problem") {
        if (!DOMAIN_PROBLEM_LABELS[contact.email_domain_status]) return false;
      } else if (statusFilter && contact.status !== statusFilter) return false;
      if (scopeFilter && (contact.email_scope || "location") !== scopeFilter) return false;
      if (!term) return true;
      return [contact.company_name, contact.email, contact.city, contact.county]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [contacts, search, statusFilter, scopeFilter]);

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
    // Un lot care cade (timeout, limita de cereri) se reincearca de doua ori inainte sa oprim.
    // Sincronizarea e idempotenta, deci reluarea aceluiasi lot nu dubleaza nimic.
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
      setError(`Sincronizarea s-a oprit la ${cursor} adrese. Apasa din nou: continua fara dubluri. (${err.response?.data?.error || err.message})`);
    }
    setSyncing(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border p-5">
        <h3 className="text-sm font-bold text-foreground">Materializeaza contacte din director</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Creeaza sau actualizeaza contacte de outreach din locatiile publicate care au o adresa
          publica de contact, completand automat temeiul legal si provenienta din datele locatiei.
          Lanturile cu aceeasi adresa pe mai multe locatii devin un singur contact.
        </p>
        <div className="mt-4">
          <OutreachAudienceBuilder filters={syncFilters} onChange={setSyncFilters} disabled={syncing} hideContactOnlyFilters />
        </div>
        <button
          type="button"
          onClick={runSync}
          disabled={syncing}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {syncing ? "Se sincronizeaza..." : "Sincronizeaza acum"}
        </button>
        {syncSummary && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground">
              {syncSummary.created} create, {syncSummary.updated} actualizate, {syncSummary.unchanged} neschimbate, {syncSummary.skipped} sarite
              {syncSummary.done
                ? ` — finalizat: ${syncSummary.total} locatii publicate cu email, ${syncSummary.uniqueEmails} adrese unice.`
                : ` — in curs: ${syncSummary.processed} din ${syncSummary.uniqueEmails} adrese...`}
            </p>
            {(syncSummary.undeliverable > 0 || syncSummary.dnsErrors > 0) && (
              <p className="text-xs text-amber-700">
                {syncSummary.undeliverable > 0 && `${syncSummary.undeliverable} adrese sunt pe domenii care nu pot primi email si nu vor primi campanii. `}
                {syncSummary.dnsErrors > 0 && `${syncSummary.dnsErrors} domenii au raspuns cu eroare DNS; se reverifica inainte de trimitere. `}
                Le gasesti cu filtrul „Probleme de domeniu”.
              </p>
            )}
            {syncSummary.breakdown && <TagBreakdown breakdown={syncSummary.breakdown} />}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground">Contacte ({filtered.length} din {contacts.length})</h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Cauta firma, email, oras..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            />
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              <option value="">Toate adresele</option>
              <option value="location">Adrese de locatie</option>
              <option value="organization">Adrese de organizatie</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              <option value="">Toate statusurile</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
              <option value="__domain_problem">Probleme de domeniu</option>
            </select>
            <button type="button" onClick={load} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">
              Reincarca
            </button>
          </div>
        </div>

        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Se incarca...
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/60 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Firma</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Localitate</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Temei legal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((contact) => (
                  <tr key={contact.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">
                      {contact.company_name || "—"}
                      {contact.email_scope === "organization" && (
                        <span className="ml-2 whitespace-nowrap rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground" title="Aceeasi adresa e folosita de mai multe locatii din director">
                          Organizatie · {contact.shared_location_count || "?"} locatii{(contact.shared_city_count || 0) > 1 ? ` · ${contact.shared_city_count} orase` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {contact.email}
                      {DOMAIN_PROBLEM_LABELS[contact.email_domain_status] && (
                        <span
                          className={`ml-2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${UNDELIVERABLE_DOMAIN.includes(contact.email_domain_status) ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
                          title={UNDELIVERABLE_DOMAIN.includes(contact.email_domain_status) ? "Nu se trimite la aceasta adresa: ar fi respinsa sigur." : "Se reverifica inainte de fiecare trimitere."}
                        >
                          {DOMAIN_PROBLEM_LABELS[contact.email_domain_status]}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{[contact.city, contact.county].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(contact.status)}`}>
                        {STATUS_LABELS[contact.status] || contact.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{contact.lawful_basis || "—"}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Niciun contact.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
