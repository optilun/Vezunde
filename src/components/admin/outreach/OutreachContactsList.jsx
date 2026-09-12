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

const EMPTY_FILTERS = { target_counties: [], target_provider_types: [], target_profile_control_status: [], target_tags: [] };

export default function OutreachContactsList() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
      if (statusFilter && contact.status !== statusFilter) return false;
      if (!term) return true;
      return [contact.company_name, contact.email, contact.city, contact.county]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [contacts, search, statusFilter]);

  const runSync = async () => {
    setSyncing(true);
    setSyncSummary(null);
    setError("");
    let cursor = 0;
    let hasMore = true;
    const totals = { created: 0, updated: 0, skipped: 0 };
    try {
      while (hasMore) {
        const response = await base44.functions.invoke("outreachCampaignOps", {
          action: "sync_contacts_from_directory",
          cursor,
          target_counties: syncFilters.target_counties,
          target_provider_types: syncFilters.target_provider_types,
          target_profile_control_status: syncFilters.target_profile_control_status,
        });
        const data = response.data || {};
        if (data.error) { setError(data.error); break; }
        totals.created += data.created || 0;
        totals.updated += data.updated || 0;
        totals.skipped += data.skipped || 0;
        cursor = data.next_cursor || cursor;
        hasMore = !!data.has_more;
        setSyncSummary({ ...totals, done: !hasMore });
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
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
          publica de contact (public_email), completand automat temeiul legal si provenienta din
          datele deja existente ale locatiei.
        </p>
        <div className="mt-4">
          <OutreachAudienceBuilder filters={syncFilters} onChange={setSyncFilters} disabled={syncing} />
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
          <p className="mt-2 text-xs text-muted-foreground">
            {syncSummary.created} create, {syncSummary.updated} actualizate, {syncSummary.skipped} sarite
            {syncSummary.done ? " — finalizat." : " — in curs..."}
          </p>
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs"
            >
              <option value="">Toate statusurile</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
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
                    <td className="px-3 py-2 font-medium text-foreground">{contact.company_name || "—"}</td>
                    <td className="px-3 py-2">{contact.email}</td>
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
