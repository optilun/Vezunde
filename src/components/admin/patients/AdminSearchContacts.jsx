import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, Mail, Megaphone, Phone, Search, Trash2, UserRound, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { downloadCsv, formatDateTime } from "@/components/admin/outreach/outreachLabels";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import { useAdminConfirm } from "@/components/admin/ui/AdminConfirm";
import { AdminRefreshButton, AdminSearchField, useScrollToDetail } from "@/components/admin/ui/AdminListControls";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { fullDateTime, plural, relativeTime } from "@/lib/adminFormat";
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
  searchContactFollowUpTone,
  searchContactPlaceLabel,
} from "@/lib/adminSearchContacts";

// 2026-09-28, cererea owner-ului: datele de contact lasate de pacienti la cautare, vizibile in
// panoul de admin VIASEE. Entitatea PatientSearchContact e accesibila doar adminilor (RLS), deci
// citirea si modificarile se fac direct, din contul de admin. Regulile de colectare:
// shared/patientSearchContact.js.
// 2026-10-07: se deschide pe „Noi”, „Marchează contactat” dintr-un click (apoi trece la următorul),
// ștergerea și dezabonarea cer confirmare într-un dialog, ciorna notei se păstrează, o listă care nu se
// încarcă nu mai spune „Încă nu a lăsat nimeni datele”.
const LOAD_LIMIT = 500;

function FollowUpBadge({ row }) {
  return <StatusBadge label={searchContactFollowUpLabel(row)} tone={searchContactFollowUpTone(row)} />;
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

const draftFrom = (contact) => ({
  follow_up_status: searchContactFollowUp(contact),
  follow_up_note: contact?.follow_up_note || "",
});

export default function AdminSearchContacts() {
  const confirm = useAdminConfirm();
  const [contacts, setContacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("nou");
  const [offersOnly, setOffersOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState({});
  const loadSeq = useRef(0);
  const detailRef = useRef(null);
  const scrollToDetail = useScrollToDetail(detailRef);

  const loadContacts = useCallback(async () => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setLoadError("");
    try {
      const rows = (await base44.entities.PatientSearchContact.list("-created_date", LOAD_LIMIT)) || [];
      if (seq === loadSeq.current) setContacts(rows);
      return rows;
    } catch (requestError) {
      if (seq === loadSeq.current) setLoadError(errorText(requestError, "Contactele nu au putut fi încărcate."));
      return null;
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  const counts = useMemo(() => countSearchContacts(contacts), [contacts]);
  const visibleContacts = useMemo(
    () => filterSearchContacts(contacts, { status: statusFilter, query, offersOnly }),
    [contacts, offersOnly, query, statusFilter],
  );

  useEffect(() => {
    if (!contacts) return;
    if (visibleContacts.length === 0) setSelectedId("");
    else if (!visibleContacts.some((row) => row.id === selectedId)) setSelectedId(visibleContacts[0].id);
  }, [contacts, selectedId, visibleContacts]);

  const selected = useMemo(() => contacts?.find((row) => row.id === selectedId) || null, [contacts, selectedId]);

  // Ciorna notei rămâne cât timp contactul nu s-a schimbat pe server (altfel pornim de la el).
  const baseDraft = useMemo(() => draftFrom(selected), [selected]);
  const stored = drafts[selectedId];
  const draft = stored && stored.base === (selected?.updated_date || "") ? stored.value : baseDraft;
  const updateDraft = (changes) => setDrafts((current) => ({
    ...current,
    [selectedId]: { base: selected?.updated_date || "", value: { ...draft, ...changes } },
  }));

  const selectContact = (id) => {
    setSelectedId(id);
    setError("");
    setMessage("");
    scrollToDetail();
  };

  const runUpdate = async (changes, successMessage, { advance = false, key = "save" } = {}) => {
    if (!selected || saving) return;
    const contactId = selected.id;
    // În lista „Noi”, după ce rezolvi un contact trecem la următorul; în rest rămânem pe cel curent.
    const advanceTo = advance && statusFilter === "nou" ? visibleContacts.find((row) => row.id !== contactId)?.id || "" : "";
    setSaving(key);
    setError("");
    setMessage("");
    try {
      await base44.entities.PatientSearchContact.update(contactId, changes);
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== contactId)));
      const rows = await loadContacts();
      setMessage(successMessage);
      if (advanceTo && rows?.some((row) => row.id === advanceTo)) {
        setSelectedId(advanceTo);
        scrollToDetail();
      }
    } catch (requestError) {
      setError(errorText(requestError, "Modificarea nu a putut fi salvată."));
    } finally {
      setSaving("");
    }
  };

  const saveFollowUp = () => runUpdate({
    follow_up_status: draft.follow_up_status,
    follow_up_note: draft.follow_up_note.trim().slice(0, 2000),
  }, "Urmărirea a fost salvată.", { advance: draft.follow_up_status !== "nou" });

  // Un click: „Contactat”, cu nota scrisă până acum.
  const markContacted = () => runUpdate({
    follow_up_status: "contactat",
    follow_up_note: draft.follow_up_note.trim().slice(0, 2000),
  }, "Marcat ca „contactat”.", { advance: true, key: "contacted" });

  const unsubscribe = async () => {
    const ok = await confirm({
      title: "Dezabonezi persoana de la oferte?",
      description: "Nu va mai primi oferte. Datele ei rămân în listă.",
      confirmLabel: "Dezabonează",
    });
    if (!ok) return;
    await runUpdate({ marketing_unsubscribed_at: new Date().toISOString() }, "Persoana nu va mai primi oferte.", { key: "unsubscribe" });
  };

  // Stergerea e pentru cererile de stergere ale persoanei (GDPR art. 17). Cere confirmare.
  const deleteContact = async () => {
    if (!selected || saving) return;
    const ok = await confirm({
      title: "Ștergi definitiv datele persoanei?",
      description: "Datele ei de contact se șterg din VIASEE (la cererea persoanei, GDPR). Nu se mai pot recupera.",
      confirmLabel: "Șterge definitiv",
      tone: "danger",
    });
    if (!ok) return;
    setSaving("delete");
    setError("");
    setMessage("");
    try {
      await base44.entities.PatientSearchContact.delete(selected.id);
      setSelectedId("");
      await loadContacts();
      setMessage("Datele au fost șterse.");
    } catch (requestError) {
      setError(errorText(requestError, "Datele nu au putut fi șterse."));
    } finally {
      setSaving("");
    }
  };

  const exportVisible = () => {
    const day = new Date().toISOString().slice(0, 10);
    downloadCsv(`contacte-cautari-${day}.csv`, [...SEARCH_CONTACT_CSV_HEADER], searchContactCsvRows(visibleContacts));
  };

  const chips = [
    ...SEARCH_CONTACT_FOLLOW_UP_OPTIONS.map((option) => ({ key: option.value, label: option.value === "nou" ? "Noi" : option.label, count: counts[option.value] })),
    { key: "all", label: "Toate", count: counts.total },
  ];
  const filtering = Boolean(query.trim()) || offersOnly;
  const capped = Boolean(contacts) && contacts.length >= LOAD_LIMIT;

  return (
    <div className="space-y-4" data-admin-mobile="true">
      <AdminCard className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearchField
            value={query}
            onChange={setQuery}
            label="Caută în contacte"
            placeholder="Caută după nume, telefon, email, nevoie sau localitate"
          />
          <AdminRefreshButton onClick={loadContacts} busy={loading && Boolean(contacts)} />
        </div>
        <AdminChips options={chips} value={statusFilter} onChange={setStatusFilter} label="Filtrează contactele" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={offersOnly}
              onChange={(event) => setOffersOnly(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Doar cei care pot primi oferte ({counts.offers})
          </label>
          <button
            type="button"
            onClick={exportVisible}
            disabled={visibleContacts.length === 0}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportă lista ({visibleContacts.length})
          </button>
        </div>
      </AdminCard>

      {loadError && <AdminNotice tone="danger">{loadError}</AdminNotice>}
      {error && <AdminNotice tone="danger" onDismiss={() => setError("")}>{error}</AdminNotice>}
      {message && <AdminNotice tone="success" onDismiss={() => setMessage("")}>{message}</AdminNotice>}
      {capped && (
        <AdminNotice tone="warning">
          Se afișează cele mai recente {LOAD_LIMIT} de contacte; numerele de pe filtre se referă la ele.
        </AdminNotice>
      )}

      {!contacts && loading && <AdminLoading label="Se încarcă contactele…" />}

      {!contacts && !loading && loadError && (
        <AdminCard className="p-5">
          <EmptyState icon={Users} title="Contactele nu s-au putut încărca." subtitle="Verifică conexiunea și încearcă din nou." ctaLabel="Încearcă din nou" onCta={loadContacts} />
        </AdminCard>
      )}

      {contacts && contacts.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={Users}
            title="Încă nu a lăsat nimeni datele de contact."
            subtitle="Datele lăsate de pacienți la pasul „Date de contact” din căutare apar aici, singure."
          />
        </AdminCard>
      )}

      {contacts && contacts.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
              {plural(visibleContacts.length, "contact", "contacte")}
            </div>
            {visibleContacts.length === 0 ? (
              <div className="p-5">
                {statusFilter === "nou" && !filtering ? (
                  <EmptyState icon={Users} title="Nu ai contacte noi." subtitle="Le-ai urmărit pe toate." ctaLabel="Vezi toate contactele" onCta={() => setStatusFilter("all")} />
                ) : (
                  <EmptyState
                    icon={Search}
                    title="Niciun contact pentru filtrele alese."
                    ctaLabel="Șterge filtrele"
                    onCta={() => { setQuery(""); setOffersOnly(false); setStatusFilter("all"); }}
                  />
                )}
              </div>
            ) : (
              <ul aria-label="Contacte din căutări" className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {visibleContacts.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => selectContact(row.id)}
                      aria-current={row.id === selectedId ? "true" : undefined}
                      className={`block w-full border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                        row.id === selectedId ? "border-foreground bg-secondary/70" : "border-transparent hover:bg-secondary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{row.contact_name || "Fără nume"}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {[row.intent_label, row.city].filter(Boolean).join(" · ") || "Căutare fără detalii"}
                          </div>
                        </div>
                        <FollowUpBadge row={row} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <div className="flex flex-wrap gap-1.5">
                          {canReceiveSearchContactOffers(row) && <StatusBadge tone="success" label="Oferte" />}
                          {row.linked_request_id && <StatusBadge tone="info" label="Cerere" />}
                        </div>
                        <span title={fullDateTime(row.created_date)}>{relativeTime(row.created_date)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            <div ref={detailRef} className="scroll-mt-20" />
            {!selected ? (
              <EmptyState icon={UserRound} title="Alege un contact din listă." subtitle="Datele și căutarea persoanei apar aici." />
            ) : (
              <div className="space-y-4">
                <div className="border-b border-border pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <FollowUpBadge row={selected} />
                    {canReceiveSearchContactOffers(selected) && <StatusBadge tone="success" label="Poate primi oferte" />}
                    {selected.linked_request_id && <StatusBadge tone="info" label="A salvat o cerere" />}
                  </div>
                  <h2 className="mt-3 font-heading text-xl font-extrabold">{selected.contact_name || "Fără nume"}</h2>
                  <p className="mt-1 text-xs text-muted-foreground" title={fullDateTime(selected.created_date)}>
                    Lăsat {relativeTime(selected.created_date)} · {formatDateTime(selected.created_date)}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-3 rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Contact
                    </div>
                    <DetailRow label="Telefon">
                      {selected.contact_phone ? (
                        <a href={`tel:${selected.contact_phone.replace(/[^0-9+]/g, "")}`} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
                          <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {selected.contact_phone}
                        </a>
                      ) : "—"}
                    </DetailRow>
                    <DetailRow label="Email">
                      {selected.contact_email ? (
                        <a href={`mailto:${selected.contact_email}`} className="inline-flex items-center gap-1.5 break-all font-semibold underline underline-offset-4">
                          <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {selected.contact_email}
                        </a>
                      ) : "—"}
                    </DetailRow>
                    <DetailRow label="Vârsta">{searchContactAgeLabel(selected)}</DetailRow>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Ce a căutat
                    </div>
                    <DetailRow label="Nevoie">{selected.intent_label || "—"}</DetailRow>
                    <DetailRow label="Localitate">{searchContactPlaceLabel(selected)}</DetailRow>
                    <DetailRow label="Pentru cine">{SEARCH_CONTACT_FOR_WHOM_LABELS[selected.for_whom] || "—"}</DetailRow>
                    <DetailRow label="Termen">{SEARCH_CONTACT_TIMING_LABELS[selected.timing_key] || "—"}</DetailRow>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Acorduri și cerere
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

                <section aria-label="Urmărire" className="space-y-3 rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="text-xs font-bold">Urmărire</div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Notă internă
                    <textarea
                      value={draft.follow_up_note}
                      onChange={(event) => updateDraft({ follow_up_note: event.target.value })}
                      maxLength={2000}
                      rows={3}
                      placeholder="Ex: sunat pe 29.09, revine după salariu"
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    {searchContactFollowUp(selected) !== "contactat" && (
                      <button
                        type="button"
                        onClick={markContacted}
                        disabled={Boolean(saving)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-xs font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
                      >
                        {saving === "contacted" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                        Marchează contactat
                      </button>
                    )}
                    <label className="text-xs font-semibold text-muted-foreground">
                      Stare
                      <select
                        value={draft.follow_up_status}
                        onChange={(event) => updateDraft({ follow_up_status: event.target.value })}
                        className="ml-2 min-h-10 rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {SEARCH_CONTACT_FOLLOW_UP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={saveFollowUp}
                      disabled={Boolean(saving)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      {saving === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                      Salvează
                    </button>
                  </div>
                </section>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  {canReceiveSearchContactOffers(selected) && (
                    <button
                      type="button"
                      onClick={unsubscribe}
                      disabled={Boolean(saving)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
                    >
                      <Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> Dezabonează de la oferte
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={deleteContact}
                    disabled={Boolean(saving)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-danger-border bg-background px-4 text-xs font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Șterge datele (la cererea persoanei)
                  </button>
                </div>
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
