import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserPlus } from "lucide-react";
import OutreachAudienceBuilder from "./OutreachAudienceBuilder";
import {
  SOURCE_OPTIONS,
  SOURCE_LABELS,
  BLOCK_REASON_LABELS,
  PROVIDER_TYPE_LABELS,
  callOutreach,
} from "./outreachLabels";

// Pasul "Destinatari": cine primeste campania, vazut ca lista reala, nu doar ca numar.
// - sursa: contactele din director si/sau furnizorii cu cont;
// - mod: dupa filtre (cu bife pentru a scoate pe cineva) sau doar persoanele alese de mana;
// - adaugare manuala: orice contact, chiar daca nu se potriveste filtrelor.
// Lista vine de la backend (list_recipients), calculata exact ca la aprobare.

const AUDIENCE_KEYS = [
  "category", "audience_sources", "audience_mode", "included_contact_ids", "excluded_contact_ids",
  "target_counties", "target_provider_types", "target_profile_control_status", "target_tags", "target_email_scope",
];

const VIEW_FILTERS = [
  { value: "all", label: "Toti" },
  { value: "receives", label: "Primesc" },
  { value: "excluded", label: "Scosi de mine" },
  { value: "blocked", label: "Nu pot primi" },
];

const PAGE = 150;

export default function OutreachRecipientPicker({ spec, onChange, disabled = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);

  const specKey = JSON.stringify(AUDIENCE_KEYS.map((key) => spec[key] ?? null));

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      const payload = Object.fromEntries(AUDIENCE_KEYS.map((key) => [key, spec[key]]));
      const result = await callOutreach("outreachCampaignOps", "list_recipients", payload);
      if (!active) return;
      setLoading(false);
      if (result.error) { setError(result.error); return; }
      setError("");
      setData(result);
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [specKey]);

  useEffect(() => {
    let active = true;
    if (addQuery.trim().length < 2) { setAddResults([]); return undefined; }
    const timer = setTimeout(async () => {
      const result = await callOutreach("outreachCampaignOps", "search_contacts", { query: addQuery.trim() });
      if (active) setAddResults(result.contacts || []);
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [addQuery]);

  const included = Array.isArray(spec.included_contact_ids) ? spec.included_contact_ids : [];
  const excluded = Array.isArray(spec.excluded_contact_ids) ? spec.excluded_contact_ids : [];
  const sources = Array.isArray(spec.audience_sources) && spec.audience_sources.length ? spec.audience_sources : ["directory"];
  const manualOnly = spec.audience_mode === "manual";

  const rows = data?.rows || [];
  // Bifele reflecta imediat alegerea locala; lista de la server se reincarca dupa o clipa si
  // confirma (numerele din rezumat vin de acolo).
  const isExcluded = (row) => excluded.includes(row.id) || (row.added_manually && !included.includes(row.id));
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const out = isExcluded(row);
      if (view === "receives" && (out || row.reason)) return false;
      if (view === "excluded" && !out) return false;
      if (view === "blocked" && (!row.reason || out)) return false;
      if (!term) return true;
      return [row.company_name, row.contact_name, row.email, row.city, row.county]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [rows, search, view, excluded, included]);

  const toggleSource = (value) => {
    const next = sources.includes(value) ? sources.filter((item) => item !== value) : [...sources, value];
    if (!next.length) return; // cel putin o sursa
    onChange({ audience_sources: next });
  };

  // Bifa = primeste. Un contact adaugat de mana se scoate din adaugari; unul venit din filtre se
  // trece la \"scosi\".
  const setReceives = (row, receives) => {
    if (receives) {
      onChange({ excluded_contact_ids: excluded.filter((id) => id !== row.id) });
    } else if (row.added_manually) {
      onChange({ included_contact_ids: included.filter((id) => id !== row.id) });
    } else {
      onChange({ excluded_contact_ids: [...new Set([...excluded, row.id])] });
    }
  };

  const setAllVisible = (receives) => {
    const ids = filteredRows.filter((row) => !row.reason).map((row) => row.id);
    if (receives) {
      onChange({ excluded_contact_ids: excluded.filter((id) => !ids.includes(id)) });
    } else {
      const manual = filteredRows.filter((row) => row.added_manually).map((row) => row.id);
      onChange({
        excluded_contact_ids: [...new Set([...excluded, ...ids.filter((id) => !manual.includes(id))])],
        included_contact_ids: included.filter((id) => !manual.includes(id)),
      });
    }
  };

  const addManually = (contactId) => {
    onChange({
      included_contact_ids: [...new Set([...included, contactId])],
      excluded_contact_ids: excluded.filter((id) => id !== contactId),
    });
  };

  const counts = data?.counts;
  const blockedEntries = Object.entries(counts?.blocked || {});
  const sourceCounts = data?.facets?.sources || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className="text-xs font-semibold text-foreground">Cui trimiti</span>
          <div className="mt-1 space-y-2">
            {SOURCE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={sources.includes(option.value)}
                  onChange={() => toggleSource(option.value)}
                  className="mt-0.5"
                />
                <span>
                  {option.label}
                  {sourceCounts[option.value] !== undefined && <span className="text-muted-foreground"> ({sourceCounts[option.value]})</span>}
                  <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs font-semibold text-foreground">Cum alegi</span>
          <div className="mt-1 space-y-2">
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input type="radio" name="outreach-audience-mode" disabled={disabled} checked={!manualOnly} onChange={() => onChange({ audience_mode: "filters" })} className="mt-0.5" />
              <span>
                Dupa filtre
                <span className="block text-[11px] text-muted-foreground">Toti cei care se potrivesc; poti debifa pe oricine si poti adauga altii de mana.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input type="radio" name="outreach-audience-mode" disabled={disabled} checked={manualOnly} onChange={() => onChange({ audience_mode: "manual" })} className="mt-0.5" />
              <span>
                Doar cei alesi de mine
                <span className="block text-[11px] text-muted-foreground">Pentru un email catre cateva adrese anume: le cauti si le adaugi mai jos.</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {!manualOnly && (
        <OutreachAudienceBuilder
          filters={spec}
          onChange={(next) => onChange(next)}
          disabled={disabled}
          options={{ counties: data?.facets?.counties || [], providerTypes: data?.facets?.provider_types || [] }}
        />
      )}

      <div className="rounded-xl border border-border p-3">
        <label htmlFor="outreach-add-contact" className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <UserPlus className="h-3.5 w-3.5" /> Adauga manual
        </label>
        <input
          id="outreach-add-contact"
          type="text"
          disabled={disabled}
          value={addQuery}
          placeholder="Cauta dupa firma, email sau oras..."
          onChange={(e) => setAddQuery(e.target.value)}
          className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm"
        />
        {addResults.length > 0 && (
          <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {addResults.map((contact) => {
              const already = included.includes(contact.id) || rows.some((row) => row.id === contact.id && !isExcluded(row));
              return (
                <li key={contact.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{contact.company_name || contact.email}</span>
                    <span className="block truncate text-muted-foreground">{contact.email}{contact.city ? ` · ${contact.city}` : ""} · {SOURCE_LABELS[contact.kind]}</span>
                  </span>
                  <button
                    type="button"
                    disabled={disabled || already}
                    onClick={() => addManually(contact.id)}
                    className="shrink-0 rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50"
                  >
                    {already ? "In lista" : "Adauga"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="rounded-xl bg-secondary/60 px-4 py-3 text-xs text-foreground">
        {counts ? (
          <>
            <p>
              <strong className="text-base tabular-nums">{counts.eligible}</strong> {counts.eligible === 1 ? "adresa primeste" : "adrese primesc"} emailul
              {counts.excluded > 0 && ` · ${counts.excluded} scoase de tine`}
              {counts.added_manually > 0 && ` · ${counts.added_manually} adaugate de mana`}
              {loading && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />}
            </p>
            {blockedEntries.length > 0 && (
              <p className="mt-1 text-muted-foreground">
                Nu pot primi: {blockedEntries.map(([reason, count]) => `${count} — ${BLOCK_REASON_LABELS[reason] || reason}`).join("; ")}.
              </p>
            )}
          </>
        ) : (
          <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Se calculeaza lista...</span>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="outreach-recipient-search"
              type="text"
              value={search}
              placeholder="Cauta in lista..."
              onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }}
              className="rounded-lg border border-border py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
          {VIEW_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { setView(option.value); setLimit(PAGE); }}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${view === option.value ? "bg-foreground text-background" : "border border-border hover:bg-secondary"}`}
            >
              {option.label}
            </button>
          ))}
          <span className="ml-auto flex gap-2">
            <button type="button" disabled={disabled} onClick={() => setAllVisible(true)} className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50">Bifeaza tot</button>
            <button type="button" disabled={disabled} onClick={() => setAllVisible(false)} className="rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-secondary disabled:opacity-50">Debifeaza tot</button>
          </span>
        </div>

        <div className="mt-2 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2"><span className="sr-only">Primeste</span></th>
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Localitate</th>
                <th className="px-3 py-2">Sursa</th>
                <th className="px-3 py-2">Stare</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, limit).map((row) => {
                const out = isExcluded(row);
                const receives = !out && !row.reason;
                return (
                  <tr key={row.id} className={`border-t border-border ${out || row.reason ? "text-muted-foreground" : ""}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Trimite catre ${row.email}`}
                        disabled={disabled || !!row.reason}
                        checked={receives}
                        onChange={(e) => setReceives(row, e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-foreground">{row.company_name || "—"}</span>
                      {row.kind === "directory" && row.email_scope === "organization" && (
                        <span className="ml-1 text-[10px] text-muted-foreground">· {row.shared_location_count} locatii</span>
                      )}
                      {row.provider_type && <span className="block text-[10px] text-muted-foreground">{PROVIDER_TYPE_LABELS[row.provider_type] || row.provider_type}</span>}
                    </td>
                    <td className="px-3 py-2">{row.email}</td>
                    <td className="px-3 py-2">{[row.city, row.county].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2">{SOURCE_LABELS[row.kind] || row.kind}{row.added_manually ? " · adaugat de mana" : ""}</td>
                    <td className="px-3 py-2">
                      {row.reason ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{BLOCK_REASON_LABELS[row.reason] || row.reason}</span>
                      ) : out ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold">Scos de tine</span>
                      ) : (
                        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-800">Primeste</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{data ? "Nimeni in aceasta vedere." : "Se incarca..."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > limit && (
          <button type="button" onClick={() => setLimit((value) => value + PAGE)} className="mt-2 rounded-full border border-border px-3 py-1 text-[11px] font-semibold hover:bg-secondary">
            Arata inca {Math.min(PAGE, filteredRows.length - limit)} din {filteredRows.length - limit}
          </button>
        )}
      </div>
    </div>
  );
}
