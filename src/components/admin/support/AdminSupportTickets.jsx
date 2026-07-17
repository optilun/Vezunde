import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const ACTIVE_STATUSES = new Set(["open", "in_progress", "waiting_user"]);

const STATUS_OPTIONS = [
  { value: "open", label: "Deschis" },
  { value: "in_progress", label: "În lucru" },
  { value: "waiting_user", label: "Așteaptă utilizatorul" },
  { value: "resolved", label: "Rezolvat" },
  { value: "closed", label: "Închis" },
];

const STATUS_STYLE = {
  open: ["Deschis", "border-blue-200 bg-blue-50 text-blue-800"],
  in_progress: ["În lucru", "border-amber-200 bg-amber-50 text-amber-800"],
  waiting_user: ["Așteaptă utilizatorul", "border-violet-200 bg-violet-50 text-violet-800"],
  resolved: ["Rezolvat", "border-green-200 bg-green-50 text-green-800"],
  closed: ["Închis", "border-border bg-secondary text-muted-foreground"],
};

const PRIORITY_OPTIONS = [
  { value: "low", label: "Scăzută" },
  { value: "normal", label: "Normală" },
  { value: "high", label: "Ridicată" },
  { value: "urgent", label: "Urgentă" },
];

const PRIORITY_STYLE = {
  low: ["Scăzută", "text-muted-foreground"],
  normal: ["Normală", "text-foreground"],
  high: ["Ridicată", "text-amber-700"],
  urgent: ["Urgentă", "font-bold text-red-700"],
};

const CATEGORY_LABELS = {
  account: "Cont și autentificare",
  organization: "Organizație sau locație",
  professional: "Profil profesional",
  patient_request: "Solicitări pacienți",
  technical: "Problemă tehnică",
  other: "Altă situație",
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}

function StatusBadge({ status }) {
  const [label, className] = STATUS_STYLE[status] || STATUS_STYLE.open;
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${className}`}>
      {label}
    </span>
  );
}

function matchesSearch(ticket, query) {
  if (!query) return true;
  return [
    ticket.subject,
    ticket.description,
    ticket.requester_name,
    ticket.requester_email,
    ticket.category,
    ticket.source,
    ticket.page_path,
  ].some((value) => String(value || "").toLowerCase().includes(query));
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

export default function AdminSupportTickets({ adminUser }) {
  const [tickets, setTickets] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({
    status: "open",
    priority: "normal",
    response: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadTickets = useCallback(async ({ preserveSelection = true } = {}) => {
    setLoading(true);
    setError("");
    try {
      const rows = await base44.entities.SupportTicket.list("-updated_date", 500);
      const nextTickets = rows || [];
      setTickets(nextTickets);
      setSelectedId((current) => {
        if (preserveSelection && current && nextTickets.some((ticket) => ticket.id === current)) {
          return current;
        }
        return nextTickets[0]?.id || "";
      });
    } catch (requestError) {
      setTickets([]);
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || "Tichetele de suport nu au putut fi încărcate.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets({ preserveSelection: false });
  }, [loadTickets]);

  const selectedTicket = useMemo(
    () => tickets?.find((ticket) => ticket.id === selectedId) || null,
    [selectedId, tickets],
  );

  useEffect(() => {
    if (!selectedTicket) return;
    setDraft({
      status: selectedTicket.status || "open",
      priority: selectedTicket.priority || "normal",
      response: selectedTicket.support_response || "",
    });
  }, [selectedTicket]);

  const counts = useMemo(() => {
    const rows = tickets || [];
    return {
      active: rows.filter((ticket) => ACTIVE_STATUSES.has(ticket.status || "open")).length,
      urgent: rows.filter(
        (ticket) => ACTIVE_STATUSES.has(ticket.status || "open") && ticket.priority === "urgent",
      ).length,
      resolved: rows.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length,
      total: rows.length,
    };
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (tickets || []).filter((ticket) => {
      const status = ticket.status || "open";
      if (statusFilter === "active" && !ACTIVE_STATUSES.has(status)) return false;
      if (statusFilter === "resolved" && !["resolved", "closed"].includes(status)) return false;
      if (categoryFilter !== "all" && ticket.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      return matchesSearch(ticket, normalizedQuery);
    });
  }, [categoryFilter, priorityFilter, query, statusFilter, tickets]);

  useEffect(() => {
    if (visibleTickets.length === 0) {
      setSelectedId("");
      return;
    }
    if (!visibleTickets.some((ticket) => ticket.id === selectedId)) {
      setSelectedId(visibleTickets[0].id);
    }
  }, [selectedId, visibleTickets]);

  const selectTicket = (ticketId) => {
    setSelectedId(ticketId);
    setError("");
    setMessage("");
  };

  const saveTicket = async () => {
    if (!selectedTicket || saving) return;

    const response = draft.response.trim();
    if (["waiting_user", "resolved", "closed"].includes(draft.status) && !response) {
      setMessage("");
      setError("Adaugă un răspuns înainte de a muta tichetul în acest status.");
      document.getElementById("admin-support-response")?.focus();
      return;
    }

    const previousResponse = String(selectedTicket.support_response || "").trim();
    const responseChanged = response !== previousResponse;
    const payload = {
      status: draft.status,
      priority: draft.priority,
      support_response: response,
      ...(responseChanged && response
        ? {
            responded_at: new Date().toISOString(),
            responded_by_user_id: adminUser?.id || "",
          }
        : {}),
    };

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await base44.entities.SupportTicket.update(selectedTicket.id, payload);
      await loadTickets();
      setMessage(
        response
          ? "Tichetul a fost actualizat. Răspunsul este vizibil în contul utilizatorului."
          : "Statusul și prioritatea tichetului au fost actualizate.",
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || "Modificările nu au putut fi salvate.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-admin-mobile="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Inbox} label="Tichete active" value={counts.active} />
        <SummaryCard icon={AlertTriangle} label="Urgente active" value={counts.urgent} />
        <SummaryCard icon={CheckCircle2} label="Rezolvate / închise" value={counts.resolved} />
        <SummaryCard icon={Mail} label="Total tichete" value={counts.total} />
      </div>

      <AdminCard className="p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută după subiect, utilizator, email sau mesaj"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
            {[
              ["active", `Active (${counts.active})`],
              ["resolved", `Rezolvate (${counts.resolved})`],
              ["all", `Toate (${counts.total})`],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`min-h-10 rounded-xl px-3 text-xs font-semibold ${
                  statusFilter === key
                    ? "bg-foreground text-background"
                    : "border border-border bg-background hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => loadTickets()}
              disabled={loading || saving}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizează
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="sr-only">Filtru categorie</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none"
              >
                <option value="all">Toate categoriile</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filtru prioritate</span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none"
              >
                <option value="all">Toate prioritățile</option>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
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

      {loading && !tickets && (
        <AdminCard className="flex min-h-52 items-center justify-center p-5 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă tichetele...
        </AdminCard>
      )}

      {!loading && tickets?.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={Inbox}
            title="Nu există tichete de suport."
            subtitle="Solicitările trimise din Ajutor și suport vor apărea automat aici."
          />
        </AdminCard>
      )}

      {tickets && tickets.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
              {visibleTickets.length} rezultate
            </div>
            {visibleTickets.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Search}
                  title="Niciun tichet pentru filtrele selectate."
                  subtitle="Schimbă filtrul sau termenul de căutare."
                />
              </div>
            ) : (
              <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {visibleTickets.map((ticket) => {
                  const selected = ticket.id === selectedId;
                  const [priorityLabel, priorityClass] = PRIORITY_STYLE[ticket.priority]
                    || PRIORITY_STYLE.normal;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => selectTicket(ticket.id)}
                      className={`w-full p-4 text-left transition ${
                        selected ? "bg-secondary/70" : "hover:bg-secondary/35"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-sm font-bold leading-snug">
                            {ticket.subject}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {ticket.requester_name || "Utilizator VIASEE"}
                            {ticket.requester_email ? ` · ${ticket.requester_email}` : ""}
                          </div>
                        </div>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span>{CATEGORY_LABELS[ticket.category] || "Suport"}</span>
                        <span className={priorityClass}>{priorityLabel}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Actualizat {formatDate(ticket.updated_date || ticket.created_date)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            {!selectedTicket ? (
              <EmptyState
                icon={Inbox}
                title="Selectează un tichet."
                subtitle="Detaliile și acțiunile administrative vor apărea aici."
              />
            ) : (
              <div className="space-y-5">
                <div className="border-b border-border pb-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedTicket.status} />
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                      {CATEGORY_LABELS[selectedTicket.category] || "Suport"}
                    </span>
                  </div>
                  <h2 className="mt-3 break-words font-heading text-xl font-extrabold leading-snug">
                    {selectedTicket.subject}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Creat {formatDate(selectedTicket.created_date)} · actualizat {formatDate(selectedTicket.updated_date || selectedTicket.created_date)}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <UserRound className="h-4 w-4 text-muted-foreground" /> Solicitant
                    </div>
                    <div className="mt-3 break-words text-sm font-semibold">
                      {selectedTicket.requester_name || "Utilizator VIASEE"}
                    </div>
                    <div className="mt-1 break-all text-xs text-muted-foreground">
                      {selectedTicket.requester_email || "Email indisponibil"}
                    </div>
                    <div className="mt-2 break-all text-[10px] text-muted-foreground">
                      User ID: {selectedTicket.requester_user_id}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Clock3 className="h-4 w-4 text-muted-foreground" /> Context
                    </div>
                    <div className="mt-3 space-y-1 break-all text-xs text-muted-foreground">
                      <div>Sursă: {selectedTicket.source || "—"}</div>
                      <div>Pagină: {selectedTicket.page_path || "—"}</div>
                      {selectedTicket.organization_id && (
                        <div>Organizație: {selectedTicket.organization_id}</div>
                      )}
                      {selectedTicket.professional_profile_id && (
                        <div>Profil profesional: {selectedTicket.professional_profile_id}</div>
                      )}
                    </div>
                  </div>
                </div>

                <article className="rounded-2xl border border-border bg-background p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Mesajul utilizatorului
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {selectedTicket.description}
                  </p>
                </article>

                <div className="rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="admin-ticket-status" className="text-xs font-bold">Status</label>
                      <select
                        id="admin-ticket-status"
                        value={draft.status}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          status: event.target.value,
                        }))}
                        className="mt-2 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="admin-ticket-priority" className="text-xs font-bold">Prioritate</label>
                      <select
                        id="admin-ticket-priority"
                        value={draft.priority}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          priority: event.target.value,
                        }))}
                        className="mt-2 min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none"
                      >
                        {PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label htmlFor="admin-support-response" className="text-xs font-bold">
                      Răspuns VIASEE
                    </label>
                    <textarea
                      id="admin-support-response"
                      rows={8}
                      maxLength={5000}
                      value={draft.response}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        response: event.target.value,
                      }))}
                      placeholder="Scrie răspunsul care va fi afișat în contul utilizatorului..."
                      className="mt-2 min-h-40 w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed outline-none focus:border-foreground/40"
                    />
                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                      <span>Răspunsul este vizibil în Ajutor și suport după salvare.</span>
                      <span>{draft.response.length}/5000</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={saveTicket}
                    disabled={saving}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50 sm:w-auto"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {saving ? "Se salvează..." : "Salvează și publică răspunsul"}
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
