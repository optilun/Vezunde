import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Download,
  Inbox,
  Loader2,
  Mail,
  Megaphone,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";
import { downloadCsv, formatDateTime } from "@/components/admin/outreach/outreachLabels";
import {
  SEARCH_CONTACT_CSV_HEADER,
  SEARCH_CONTACT_FOLLOW_UP_OPTIONS,
  SEARCH_CONTACT_FOR_WHOM_LABELS,
  SEARCH_CONTACT_TIMING_LABELS,
  canReceiveSearchContactOffers,
  countSearchContacts,
  filterSearchContacts,
  searchContactAgeLabel,
  searchContactCsvRows,
  searchContactFollowUp,
  searchContactFollowUpLabel,
  searchContactPlaceLabel,
} from "@/lib/adminSearchContacts";

// 2026-09-28, cererea owner-ului: datele de contact lasate de pacienti la cautare, vizibile in
// panoul de admin VIASEE. Entitatea PatientSearchContact e accesibila doar adminilor (RLS), deci
// citirea si modificarile se fac direct, din contul de admin. Regulile de colectare:
// shared/patientSearchContact.js.

const FOLLOW_UP_STYLE = {
  nou: "border-blue-200 bg-blue-50 text-blue-800",
  contactat: "border-green-200 bg-green-50 text-green-800",
  fara_raspuns: "border-amber-200 bg-amber-50 text-amber-800",
  nu_mai_contacta: "border-border bg-secondary text-muted-foreground",
};

function FollowUpBadge({ row }) {
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${FOLLOW_UP_STYLE[searchContactFollowUp(row)]}`}>
      {searchContactFollowUpLabel(row)}
    </span>
  );
}

function Tag({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-secondary text-muted-foreground",
    green: "bg-green-100 text-green-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <AdminCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-1 font-heading text-2xl font-extrabold">{value}</div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </AdminCard>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-sm">{children}</div>
    </div>
  );
}

function errorText(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

export default function AdminSearchContacts() {
  const [contacts, setContacts] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [offersOnly, setOffersOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ follow_up_status: "nou", follow_up_note: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadContacts = useCallback(async ({ preserveSelection = true } = {}) => {
    setLoading(true);
    setError("");
    try {
      const rows = (await base44.entities.PatientSearchContact.list("-created_date", 500)) || [];
      setContacts(rows);
      setSelectedId((current) => (
        preserveSelection && current && rows.some((row) => row.id === current) ? current : rows[0]?.id || ""
      ));
    } catch (requestError) {
      setContacts([]);
      setError(errorText(requestError, "Contactele nu au putut fi încărcate."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts({ preserveSelection: false });
  }, [loadContacts]);

  const counts = useMemo(() => countSearchContacts(contacts), [contacts]);
  const visibleContacts = useMemo(
    () => filterSearchContacts(contacts, { status: statusFilter, query, offersOnly }),
    [contacts, offersOnly, query, statusFilter],
  );

  useEffect(() => {
    if (visibleContacts.length === 0) {
      setSelectedId("");
      return;
    }
    if (!visibleContacts.some((row) => row.id === selectedId)) setSelectedId(visibleContacts[0].id);
  }, [selectedId, visibleContacts]);

  const selected = useMemo(
    () => contacts?.find((row) => row.id === selectedId) || null,
    [contacts, selectedId],
  );

  useEffect(() => {
    setDraft({
      follow_up_status: searchContactFollowUp(selected),
      follow_up_note: selected?.follow_up_note || "",
    });
    setConfirmDelete(false);
  }, [selected]);

  const selectContact = (id) => {
    setSelectedId(id);
    setError("");
    setMessage("");
  };

  const runUpdate = async (changes, successMessage) => {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await base44.entities.PatientSearchContact.update(selected.id, changes);
      await loadContacts();
      setMessage(successMessage);
    } catch (requestError) {
      setError(errorText(requestError, "Modificarea nu a putut fi salvată."));
    } finally {
      setSaving(false);
    }
  };

  const saveFollowUp = () => runUpdate({
    follow_up_status: draft.follow_up_status,
    follow_up_note: draft.follow_up_note.trim().slice(0, 2000),
  }, "Urmărirea a fost salvată.");

  const unsubscribe = () => runUpdate(
    { marketing_unsubscribed_at: new Date().toISOString() },
    "Persoana nu va mai primi oferte.",
  );

  // Stergerea e pentru cererile de stergere ale persoanei (GDPR art. 17). Cere confirmare.
  const deleteContact = async () => {
    if (!selected || saving) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await base44.entities.PatientSearchContact.delete(selected.id);
      await loadContacts({ preserveSelection: false });
      setMessage("Datele au fost șterse.");
    } catch (requestError) {
      setError(errorText(requestError, "Datele nu au putut fi șterse."));
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const exportVisible = () => {
    const day = new Date().toISOString().slice(0, 10);
    downloadCsv(`contacte-cautari-${day}.csv`, [...SEARCH_CONTACT_CSV_HEADER], searchContactCsvRows(visibleContacts));
  };

  const statusChips = [
    ["all", `Toate (${counts.total})`],
    ...SEARCH_CONTACT_FOLLOW_UP_OPTIONS.map((option) => [option.value, `${option.label} (${counts[option.value]})`]),
  ];

  return (
    <div className="space-y-4" data-admin-mobile="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Inbox} label="Contacte noi" value={counts.nou} />
        <SummaryCard icon={Megaphone} label="Pot primi oferte" value={counts.offers} />
        <SummaryCard icon={ClipboardList} label="Au salvat o cerere" value={counts.linked} />
        <SummaryCard icon={Users} label="Total contacte" value={counts.total} />
      </div>

      <AdminCard className="p-3 sm:p-4">
        <div className="grid gap-3">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută după nume, telefon, email, nevoie sau localitate"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {statusChips.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`min-h-10 rounded-xl px-3 text-xs font-semibold ${
                  statusFilter === key ? "bg-foreground text-background" : "border border-border bg-background hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={offersOnly}
                onChange={(event) => setOffersOnly(event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Doar cei care pot primi oferte
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportVisible}
                disabled={visibleContacts.length === 0}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Exportă lista ({visibleContacts.length})
              </button>
              <button
                type="button"
                onClick={() => loadContacts()}
                disabled={loading || saving}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Actualizează
              </button>
            </div>
          </div>
        </div>
      </AdminCard>

      {error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {message && (
        <div aria-live="polite" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {loading && !contacts && (
        <AdminCard className="flex min-h-52 items-center justify-center p-5 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă contactele...
        </AdminCard>
      )}

      {!loading && contacts?.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={Users}
            title="Încă nu a lăsat nimeni datele de contact."
            subtitle="Datele lăsate de pacienți la pasul „Date de contact” din căutare apar automat aici."
          />
        </AdminCard>
      )}

      {contacts && contacts.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
              {visibleContacts.length} rezultate
            </div>
            {visibleContacts.length === 0 ? (
              <div className="p-5">
                <EmptyState icon={Search} title="Niciun contact pentru filtrele alese." subtitle="Schimbă filtrul sau căutarea." />
              </div>
            ) : (
              <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {visibleContacts.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectContact(row.id)}
                    className={`w-full p-4 text-left transition ${row.id === selectedId ? "bg-secondary/70" : "hover:bg-secondary/35"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{row.contact_name || "Fără nume"}</div>
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {[row.intent_label, row.city].filter(Boolean).join(" · ") || "Căutare fără detalii"}
                        </div>
                      </div>
                      <FollowUpBadge row={row} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <div className="flex flex-wrap gap-1.5">
                        {canReceiveSearchContactOffers(row) && <Tag tone="green">Oferte</Tag>}
                        {row.linked_request_id && <Tag tone="blue">Cerere</Tag>}
                      </div>
                      <span>{formatDateTime(row.created_date)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            {!selected ? (
              <EmptyState icon={UserRound} title="Alege un contact." subtitle="Datele și căutarea persoanei apar aici." />
            ) : (
              <div className="space-y-5">
                <div className="border-b border-border pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <FollowUpBadge row={selected} />
                    {canReceiveSearchContactOffers(selected) && <Tag tone="green">Poate primi oferte</Tag>}
                    {selected.linked_request_id && <Tag tone="blue">A salvat o cerere</Tag>}
                  </div>
                  <h2 className="mt-4 font-heading text-xl font-extrabold">{selected.contact_name || "Fără nume"}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Lăsat pe {formatDateTime(selected.created_date)}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <UserRound className="h-4 w-4 text-muted-foreground" /> Contact
                    </div>
                    <DetailRow label="Telefon">
                      {selected.contact_phone ? (
                        <a href={`tel:${selected.contact_phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
                          <Phone className="h-3.5 w-3.5" /> {selected.contact_phone}
                        </a>
                      ) : "—"}
                    </DetailRow>
                    <DetailRow label="Email">
                      {selected.contact_email ? (
                        <a href={`mailto:${selected.contact_email}`} className="inline-flex items-center gap-1.5 break-all font-semibold underline underline-offset-4">
                          <Mail className="h-3.5 w-3.5 shrink-0" /> {selected.contact_email}
                        </a>
                      ) : "—"}
                    </DetailRow>
                    <DetailRow label="Vârsta">{searchContactAgeLabel(selected)}</DetailRow>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Search className="h-4 w-4 text-muted-foreground" /> Ce a căutat
                    </div>
                    <DetailRow label="Nevoie">{selected.intent_label || "—"}</DetailRow>
                    <DetailRow label="Localitate">{searchContactPlaceLabel(selected)}</DetailRow>
                    <DetailRow label="Pentru cine">{SEARCH_CONTACT_FOR_WHOM_LABELS[selected.for_whom] || "—"}</DetailRow>
                    <DetailRow label="Termen">{SEARCH_CONTACT_TIMING_LABELS[selected.timing_key] || "—"}</DetailRow>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Acorduri și cerere
                  </div>
                  <DetailRow label="Păstrare și contact">
                    {selected.processing_consent ? `Acordat pe ${formatDateTime(selected.processing_consent_at)}` : "—"}
                  </DetailRow>
                  <DetailRow label="Noutăți și oferte">
                    {selected.marketing_unsubscribed_at
                      ? `Dezabonat pe ${formatDateTime(selected.marketing_unsubscribed_at)}`
                      : selected.marketing_consent
                        ? `Da, din ${formatDateTime(selected.marketing_consent_at)}`
                        : "Nu"}
                  </DetailRow>
                  <DetailRow label="Cerere salvată">
                    {selected.linked_request_id ? `Da, pe ${formatDateTime(selected.linked_request_at)}` : "Nu"}
                  </DetailRow>
                </div>

                <div className="space-y-3 rounded-2xl border border-border p-4">
                  <div className="text-xs font-bold">Urmărire</div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Status
                    <select
                      value={draft.follow_up_status}
                      onChange={(event) => setDraft((current) => ({ ...current, follow_up_status: event.target.value }))}
                      className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none"
                    >
                      {SEARCH_CONTACT_FOLLOW_UP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Notă internă
                    <textarea
                      value={draft.follow_up_note}
                      onChange={(event) => setDraft((current) => ({ ...current, follow_up_note: event.target.value }))}
                      maxLength={2000}
                      rows={3}
                      placeholder="Ex: sunat pe 29.09, revine după salariu"
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={saveFollowUp}
                    disabled={saving}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50"
                  >
                    {saving ? "Se salvează..." : "Salvează"}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {canReceiveSearchContactOffers(selected) && (
                    <button
                      type="button"
                      onClick={unsubscribe}
                      disabled={saving}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      <Megaphone className="h-3.5 w-3.5" /> Dezabonează de la oferte
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={deleteContact}
                    disabled={saving}
                    className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold disabled:opacity-50 ${
                      confirmDelete ? "bg-red-600 text-white hover:bg-red-700" : "border border-red-200 bg-background text-red-700 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmDelete ? "Confirmă ștergerea definitivă" : "Șterge datele (la cererea persoanei)"}
                  </button>
                  {confirmDelete && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary"
                    >
                      Renunță
                    </button>
                  )}
                </div>
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
