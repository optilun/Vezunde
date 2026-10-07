import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox, Loader2, Search, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  EmailLink,
  FilterSelect,
  RefreshButton,
  SupportContext,
  SupportSearchField,
  useScrollToDetail,
} from "@/components/admin/support/SupportParts";
import AdminCard from "@/components/admin/ui/AdminCard";
import AdminChips from "@/components/admin/ui/AdminChips";
import AdminHint from "@/components/admin/ui/AdminHint";
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { useAdminSelectedId } from "@/components/admin/useAdminRoute";
import { fullDateTime, plural, relativeTime } from "@/lib/adminFormat";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  ticketCategoryLabel,
  ticketPriorityLabel,
  ticketPriorityTone,
  ticketStatusLabel,
  ticketStatusTone,
} from "@/lib/adminLabels";
import { matchesAllTokens, normalizeSearch, searchTokens } from "@/lib/adminSearch";
import {
  ACCOUNT_DELETION_RESPONSE_DAYS,
  accountDeletionDeadline,
  buildTicketPayload,
  isAccountDeletionRequest,
  isActiveTicket,
  isClosedTicket,
  needsAdmin,
  nextTicketToHandle,
  sortSupportTickets,
  ticketStatusOf,
  ticketUpdateProblem,
  ticketWaiting,
} from "@/lib/adminSupportRules";

// Tichete de suport (2026-10-07): lista se deschide pe „Active”, în ordinea în care ar trebui rezolvate
// (termene de ștergere de cont, apoi ce cere răspunsul tău după prioritate și vechime, apoi ce așteaptă
// utilizatorul). Răspunsul are două butoane clare, „Trimite și rezolvă” și „Trimite și așteaptă
// utilizatorul”; starea și prioritatea manuale stau în „Alte opțiuni”. Ciorna fiecărui răspuns se păstrează
// cât timp schimbi tichetul sau actualizezi lista.
const LOAD_LIMIT = 500;
const TONE_TEXT = { neutral: "text-muted-foreground", warning: "text-warning", danger: "text-danger" };

const draftFrom = (ticket) => ({
  status: ticketStatusOf(ticket),
  priority: ticket?.priority || "normal",
  response: ticket?.support_response || "",
});

function DeletionDeadlineBadge({ ticket }) {
  const deadline = accountDeletionDeadline(ticket);
  if (!deadline) return null;
  return <StatusBadge tone={deadline.tone} label={`Ștergere cont · ${deadline.label}`} />;
}

function waitingText(ticket, waiting) {
  if (!waiting) return "";
  if (ticketStatusOf(ticket) === "open") return `Primit ${waiting.label}`;
  return `Actualizat ${waiting.label}`;
}

function TicketRow({ ticket, selected, onSelect }) {
  const waiting = ticketWaiting(ticket);
  const priority = ticket.priority;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(ticket.id)}
        aria-current={selected ? "true" : undefined}
        className={`block w-full border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
          selected ? "border-foreground bg-secondary/70" : "border-transparent hover:bg-secondary/40"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-sm font-semibold leading-snug">{ticket.subject}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {ticket.requester_name || "Utilizator VIASEE"}
              {ticket.requester_email ? ` · ${ticket.requester_email}` : ""}
            </div>
          </div>
          <StatusBadge label={ticketStatusLabel(ticket.status)} tone={ticketStatusTone(ticket.status)} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>{ticketCategoryLabel(ticket.category)}</span>
          {(priority === "high" || priority === "urgent") && (
            <StatusBadge label={ticketPriorityLabel(priority)} tone={ticketPriorityTone(priority)} />
          )}
          {waiting && (
            <span className={`ml-auto ${TONE_TEXT[waiting.tone] || TONE_TEXT.neutral}`}>{waitingText(ticket, waiting)}</span>
          )}
          {!waiting && (
            <span className="ml-auto">Încheiat {relativeTime(ticket.updated_date || ticket.created_date)}</span>
          )}
        </div>
        {isAccountDeletionRequest(ticket) && accountDeletionDeadline(ticket) && (
          <div className="mt-2"><DeletionDeadlineBadge ticket={ticket} /></div>
        )}
      </button>
    </li>
  );
}

function TicketReplyForm({ ticket, draft, onChange, saving, error, onSubmit, onDismissError }) {
  const status = ticketStatusOf(ticket);
  const active = isActiveTicket(ticket);
  const busy = (key) => saving === key;
  const submitButton = (key, nextStatus, label, { primary = false, icon = true } = {}) => (
    <button
      type="button"
      onClick={() => onSubmit(nextStatus, key)}
      disabled={Boolean(saving)}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        primary ? "bg-foreground text-background hover:bg-foreground/90" : "border border-border bg-card hover:bg-secondary"
      }`}
    >
      {busy(key) ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon && <Send className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );

  return (
    <section aria-label="Răspuns" className="rounded-2xl border border-border bg-secondary/20 p-4">
      <label htmlFor="admin-support-response" className="text-sm font-semibold">Răspunsul tău</label>
      <textarea
        id="admin-support-response"
        rows={6}
        maxLength={5000}
        value={draft.response}
        onChange={(event) => {
          onChange({ response: event.target.value });
          if (error) onDismissError();
        }}
        aria-invalid={error ? "true" : undefined}
        aria-describedby="admin-support-response-help"
        placeholder="Scrie răspunsul pentru utilizator…"
        className="mt-2 min-h-32 w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed outline-none focus:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div id="admin-support-response-help" className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>Se publică în contul utilizatorului (Ajutor și suport). Nu se trimite email.</span>
        <span className="shrink-0 tabular-nums">{draft.response.length}/5000</span>
      </div>

      {error && <AdminNotice tone="danger" className="mt-3">{error}</AdminNotice>}

      <div className="mt-3 flex flex-wrap gap-2">
        {active ? (
          <>
            {submitButton("resolved", "resolved", "Trimite și rezolvă", { primary: true })}
            {submitButton("waiting_user", "waiting_user", "Trimite și așteaptă utilizatorul")}
            {status === "open" && submitButton("in_progress", "in_progress", "Marchează în lucru", { icon: false })}
          </>
        ) : (
          <>
            {submitButton("open", "open", "Redeschide tichetul", { primary: true, icon: false })}
            {submitButton("keep", status, "Salvează răspunsul")}
          </>
        )}
      </div>

      <details className="mt-3 rounded-xl border border-border bg-card px-3 py-2">
        <summary className="cursor-pointer select-none text-xs font-semibold text-muted-foreground hover:text-foreground">
          Alte opțiuni: stare și prioritate
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-ticket-status" className="text-xs font-semibold">Stare</label>
            <select
              id="admin-ticket-status"
              value={draft.status}
              onChange={(event) => onChange({ status: event.target.value })}
              className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="admin-ticket-priority" className="text-xs font-semibold">Prioritate</label>
            <select
              id="admin-ticket-priority"
              value={draft.priority}
              onChange={(event) => onChange({ priority: event.target.value })}
              className="mt-1.5 min-h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSubmit(draft.status, "options")}
          disabled={Boolean(saving)}
          className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
        >
          {busy("options") && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          Salvează starea și prioritatea
        </button>
      </details>
    </section>
  );
}

function TicketDetail({ ticket, draft, onChange, saving, error, onSubmit, onDismissError }) {
  const deadline = accountDeletionDeadline(ticket);
  const deletion = isAccountDeletionRequest(ticket);
  const priority = ticket.priority;
  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={ticketStatusLabel(ticket.status)} tone={ticketStatusTone(ticket.status)} />
          <StatusBadge label={ticketCategoryLabel(ticket.category)} />
          {(priority === "high" || priority === "urgent") && (
            <StatusBadge label={`Prioritate ${ticketPriorityLabel(priority).toLowerCase()}`} tone={ticketPriorityTone(priority)} />
          )}
          <DeletionDeadlineBadge ticket={ticket} />
        </div>
        <h2 className="mt-3 break-words font-heading text-xl font-extrabold leading-snug">{ticket.subject}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          <span title={fullDateTime(ticket.created_date)}>Primit {relativeTime(ticket.created_date)}</span>
          {" · "}
          <span title={fullDateTime(ticket.updated_date || ticket.created_date)}>actualizat {relativeTime(ticket.updated_date || ticket.created_date)}</span>
        </p>
      </div>

      {deletion && (
        <AdminNotice tone={deadline ? (deadline.tone === "neutral" ? "info" : deadline.tone) : "info"}>
          <span className="inline-flex flex-wrap items-center gap-1">
            <span>
              <span className="font-semibold">Cerere de ștergere a contului.</span>
              {deadline
                ? ` Răspunde până la ${deadline.due.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}.`
                : " Cererea este încheiată."}
            </span>
            <AdminHint label="Despre cererile de ștergere a contului">
              Cererea nu șterge nimic automat. După ce ștergi contul sau refuzi motivat, scrie-i utilizatorului un răspuns și
              rezolvă tichetul. Termenul de răspuns este de {ACCOUNT_DELETION_RESPONSE_DAYS} de zile de la cerere.
            </AdminHint>
          </span>
        </AdminNotice>
      )}

      <div className="grid gap-3 rounded-2xl border border-border bg-secondary/25 p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">De la</div>
          <div className="mt-1 break-words text-sm font-semibold">{ticket.requester_name || "Utilizator VIASEE"}</div>
          <div className="mt-0.5 text-xs"><EmailLink email={ticket.requester_email} /></div>
        </div>
        <SupportContext
          source={ticket.source}
          pagePath={ticket.page_path}
          organizationId={ticket.organization_id}
          professionalProfileId={ticket.professional_profile_id}
          userId={ticket.requester_user_id}
        />
      </div>

      <article className="rounded-2xl border border-border bg-background p-4">
        <div className="text-xs font-semibold text-muted-foreground">Mesajul utilizatorului</div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.description}</p>
      </article>

      <TicketReplyForm
        ticket={ticket}
        draft={draft}
        onChange={onChange}
        saving={saving}
        error={error}
        onSubmit={onSubmit}
        onDismissError={onDismissError}
      />
    </div>
  );
}

export default function AdminSupportTickets({ adminUser }) {
  const { refresh: refreshCounts } = useAdminCounts();
  const [tickets, setTickets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState("");
  const [saveError, setSaveError] = useState("");
  const [flash, setFlash] = useState("");
  const [focusId] = useAdminSelectedId();
  const handledFocus = useRef("");
  const pendingFocus = useRef("");
  const loadSeq = useRef(0);
  const detailRef = useRef(null);
  const scrollToDetail = useScrollToDetail(detailRef);

  const loadTickets = useCallback(async () => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setLoadError("");
    try {
      const rows = (await base44.entities.SupportTicket.list("-updated_date", LOAD_LIMIT)) || [];
      if (seq === loadSeq.current) setTickets(rows);
      return rows;
    } catch (requestError) {
      if (seq === loadSeq.current) {
        setLoadError(requestError?.response?.data?.error || requestError?.message || "Tichetele nu au putut fi încărcate.");
      }
      return null;
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const searchText = useMemo(() => new Map((tickets || []).map((ticket) => [ticket.id, normalizeSearch([
    ticket.subject,
    ticket.description,
    ticket.requester_name,
    ticket.requester_email,
    ticketCategoryLabel(ticket.category),
    ticket.page_path,
  ].filter(Boolean).join(" "))])), [tickets]);

  const counts = useMemo(() => {
    const rows = tickets || [];
    return {
      active: rows.filter(isActiveTicket).length,
      resolved: rows.filter(isClosedTicket).length,
      total: rows.length,
    };
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    const tokens = searchTokens(query);
    const filtered = (tickets || []).filter((ticket) => {
      if (statusFilter === "active" && !isActiveTicket(ticket)) return false;
      if (statusFilter === "resolved" && !isClosedTicket(ticket)) return false;
      if (categoryFilter !== "all" && ticket.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && (ticket.priority || "normal") !== priorityFilter) return false;
      return tokens.length === 0 || matchesAllTokens(searchText.get(ticket.id) || "", tokens);
    });
    return sortSupportTickets(filtered);
  }, [categoryFilter, priorityFilter, query, searchText, statusFilter, tickets]);

  const selectedTicket = useMemo(
    () => tickets?.find((ticket) => ticket.id === selectedId) || null,
    [selectedId, tickets],
  );

  // Ajuns din căutarea globală (?id=): deschide tichetul cerut, chiar dacă filtrele curente l-ar ascunde
  // (o singură dată per tichet căutat, ca să nu te tragă înapoi după fiecare salvare). Selecția propriu-zisă
  // o face efectul de mai jos, după ce filtrele au fost șterse și tichetul e în listă.
  useEffect(() => {
    if (!focusId || !tickets || handledFocus.current === focusId) return;
    handledFocus.current = focusId;
    if (!tickets.some((ticket) => ticket.id === focusId)) return;
    pendingFocus.current = focusId;
    setStatusFilter("all");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setQuery("");
  }, [focusId, tickets]);

  // Tichetul deschis rămâne cel ales cât timp e în listă; altfel îl alegem pe primul din ordinea de lucru.
  useEffect(() => {
    if (!tickets) return;
    const wanted = pendingFocus.current;
    if (wanted) {
      if (!visibleTickets.some((ticket) => ticket.id === wanted)) return; // filtrele încă se schimbă
      pendingFocus.current = "";
      setSelectedId(wanted);
      window.requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
      return;
    }
    if (visibleTickets.length === 0) {
      setSelectedId("");
    } else if (!visibleTickets.some((ticket) => ticket.id === selectedId)) {
      setSelectedId(visibleTickets[0].id);
    }
  }, [selectedId, tickets, visibleTickets]);

  // Ciorna: ce ai scris rămâne cât timp tichetul nu s-a schimbat pe server (altfel pornim de la el).
  const baseDraft = useMemo(() => draftFrom(selectedTicket), [selectedTicket]);
  const stored = drafts[selectedId];
  const draft = stored && stored.base === selectedTicket?.updated_date ? stored.value : baseDraft;
  const updateDraft = (changes) => setDrafts((current) => ({
    ...current,
    [selectedId]: { base: selectedTicket?.updated_date, value: { ...draft, ...changes } },
  }));

  const selectTicket = (ticketId) => {
    setSelectedId(ticketId);
    setSaveError("");
    setFlash("");
    scrollToDetail();
  };

  const submit = async (nextStatus, source = nextStatus) => {
    if (!selectedTicket || saving) return;
    const problem = ticketUpdateProblem({ status: nextStatus, response: draft.response });
    if (problem) {
      setSaveError(problem);
      document.getElementById("admin-support-response")?.focus();
      return;
    }
    const ticketId = selectedTicket.id;
    // În lista „Active” trecem la următorul tichet care cere răspuns; în rest rămânem pe cel curent.
    const advanceTo = statusFilter === "active" && !needsAdmin({ status: nextStatus })
      ? nextTicketToHandle(visibleTickets, ticketId)
      : "";
    const newReply = Boolean(draft.response.trim()) && draft.response.trim() !== String(selectedTicket.support_response || "").trim();
    setSaving(source);
    setSaveError("");
    setFlash("");
    try {
      await base44.entities.SupportTicket.update(ticketId, buildTicketPayload({
        ticket: selectedTicket,
        status: nextStatus,
        priority: draft.priority,
        response: draft.response,
        adminId: adminUser?.id,
      }));
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== ticketId)));
      const rows = await loadTickets();
      refreshCounts();
      const published = newReply ? "Răspunsul a fost publicat. " : "";
      const outcome = {
        resolved: "Tichetul este rezolvat.",
        closed: "Tichetul este închis.",
        waiting_user: "Tichetul așteaptă utilizatorul.",
        in_progress: "Tichetul este în lucru.",
        open: "Tichetul este deschis din nou.",
      }[nextStatus] || "Modificările au fost salvate.";
      setFlash(`${published}${outcome}`.trim());
      if (advanceTo && rows?.some((ticket) => ticket.id === advanceTo)) {
        setSelectedId(advanceTo);
        scrollToDetail();
      }
    } catch (requestError) {
      setSaveError(requestError?.response?.data?.error || requestError?.message || "Modificările nu au putut fi salvate.");
    } finally {
      setSaving("");
    }
  };

  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setStatusFilter("all");
  };

  const chips = [
    { key: "active", label: "Active", count: counts.active },
    { key: "resolved", label: "Rezolvate", count: counts.resolved },
    { key: "all", label: "Toate", count: counts.total },
  ];
  const toHandle = visibleTickets.filter(needsAdmin).length;
  const filtering = Boolean(query.trim()) || categoryFilter !== "all" || priorityFilter !== "all";
  const capped = Boolean(tickets) && tickets.length >= LOAD_LIMIT;

  return (
    <div className="space-y-4" data-admin-mobile="true">
      <AdminCard className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SupportSearchField
            value={query}
            onChange={setQuery}
            label="Caută în tichete"
            placeholder="Caută după subiect, persoană, email sau mesaj"
          />
          <RefreshButton onClick={loadTickets} busy={loading && Boolean(tickets)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminChips options={chips} value={statusFilter} onChange={setStatusFilter} label="Filtrează tichetele" />
          <div className="grid grid-cols-2 gap-2">
            <FilterSelect value={categoryFilter} onChange={setCategoryFilter} label="Filtrează după categorie">
              <option value="all">Toate categoriile</option>
              {Object.entries(TICKET_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={priorityFilter} onChange={setPriorityFilter} label="Filtrează după prioritate">
              <option value="all">Toate prioritățile</option>
              {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </FilterSelect>
          </div>
        </div>
      </AdminCard>

      {loadError && <AdminNotice tone="danger">{loadError}</AdminNotice>}
      {flash && <AdminNotice tone="success" onDismiss={() => setFlash("")}>{flash}</AdminNotice>}
      {capped && (
        <AdminNotice tone="warning">
          Se afișează cele mai recent actualizate {LOAD_LIMIT} de tichete; numerele de pe filtre se referă la ele.
        </AdminNotice>
      )}

      {!tickets && loading && <AdminLoading label="Se încarcă tichetele…" />}

      {!tickets && !loading && loadError && (
        <AdminCard className="p-5">
          <EmptyState icon={Inbox} title="Tichetele nu s-au putut încărca." subtitle="Verifică conexiunea și încearcă din nou." ctaLabel="Încearcă din nou" onCta={loadTickets} />
        </AdminCard>
      )}

      {tickets && tickets.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={Inbox}
            title="Nu ai niciun tichet."
            subtitle="Cererile trimise din Ajutor și suport apar aici, singure."
          />
        </AdminCard>
      )}

      {tickets && tickets.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
              {plural(visibleTickets.length, "tichet", "tichete")}
              {toHandle > 0 && <span className="text-foreground"> · {toHandle} {toHandle === 1 ? "cere" : "cer"} răspunsul tău</span>}
            </div>
            {visibleTickets.length === 0 ? (
              <div className="p-5">
                {statusFilter === "active" && !filtering ? (
                  <EmptyState
                    icon={Inbox}
                    title="Nu ai tichete active."
                    subtitle="Toate au primit răspuns."
                    ctaLabel="Vezi toate tichetele"
                    onCta={() => setStatusFilter("all")}
                  />
                ) : (
                  <EmptyState
                    icon={Search}
                    title="Niciun tichet pentru filtrele alese."
                    ctaLabel="Șterge filtrele"
                    onCta={clearFilters}
                  />
                )}
              </div>
            ) : (
              <ul aria-label="Tichete" className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {visibleTickets.map((ticket) => (
                  <TicketRow key={ticket.id} ticket={ticket} selected={ticket.id === selectedId} onSelect={selectTicket} />
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            <div ref={detailRef} className="scroll-mt-20" />
            {!selectedTicket ? (
              <EmptyState icon={Inbox} title="Alege un tichet din listă." subtitle="Mesajul și răspunsul apar aici." />
            ) : (
              <TicketDetail
                ticket={selectedTicket}
                draft={draft}
                onChange={updateDraft}
                saving={saving}
                error={saveError}
                onSubmit={submit}
                onDismissError={() => setSaveError("")}
              />
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
