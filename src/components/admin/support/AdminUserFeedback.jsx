import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  UserRound,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import AdminCard from "@/components/admin/ui/AdminCard";
import EmptyState from "@/components/admin/ui/EmptyState";

const STATUS_OPTIONS = [
  { value: "new", label: "Nou" },
  { value: "reviewed", label: "Revizuit" },
  { value: "archived", label: "Arhivat" },
];

const STATUS_STYLE = {
  new: ["Nou", "border-blue-200 bg-blue-50 text-blue-800"],
  reviewed: ["Revizuit", "border-green-200 bg-green-50 text-green-800"],
  archived: ["Arhivat", "border-border bg-secondary text-muted-foreground"],
};

const ACCOUNT_MODE_LABELS = {
  personal: "Cont personal",
  provider: "Organizatie / furnizor",
  professional: "Profil profesional",
  applicant: "Solicitant",
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
  const [label, className] = STATUS_STYLE[status] || STATUS_STYLE.new;
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${className}`}>
      {label}
    </span>
  );
}

function Rating({ value, compact = false }) {
  const normalized = Math.max(1, Math.min(5, Number(value) || 1));
  return (
    <div className="flex items-center gap-1" aria-label={`Evaluare ${normalized} din 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${
            index < normalized
              ? "fill-amber-400 text-amber-500"
              : "text-border"
          }`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-[10px] font-semibold text-muted-foreground">
        {normalized}/5
      </span>
    </div>
  );
}

function matchesSearch(item, query) {
  if (!query) return true;
  return [
    item.message,
    item.user_email,
    item.user_id,
    item.account_mode,
    item.source,
    item.page_path,
    item.organization_id,
    item.professional_profile_id,
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

export default function AdminUserFeedback() {
  const [feedback, setFeedback] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("new");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadFeedback = useCallback(async ({ preserveSelection = true } = {}) => {
    setLoading(true);
    setError("");
    try {
      const rows = await base44.entities.UserFeedback.list("-created_date", 500);
      const nextFeedback = rows || [];
      setFeedback(nextFeedback);
      setSelectedId((current) => {
        if (preserveSelection && current && nextFeedback.some((item) => item.id === current)) {
          return current;
        }
        return nextFeedback[0]?.id || "";
      });
    } catch (requestError) {
      setFeedback([]);
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || "Feedback-ul nu a putut fi incarcat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback({ preserveSelection: false });
  }, [loadFeedback]);

  const counts = useMemo(() => {
    const rows = feedback || [];
    return {
      new: rows.filter((item) => (item.status || "new") === "new").length,
      reviewed: rows.filter((item) => item.status === "reviewed").length,
      archived: rows.filter((item) => item.status === "archived").length,
      total: rows.length,
    };
  }, [feedback]);

  const visibleFeedback = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (feedback || []).filter((item) => {
      if (statusFilter !== "all" && (item.status || "new") !== statusFilter) return false;
      if (ratingFilter !== "all" && Number(item.rating) !== Number(ratingFilter)) return false;
      return matchesSearch(item, normalizedQuery);
    });
  }, [feedback, query, ratingFilter, statusFilter]);

  useEffect(() => {
    if (visibleFeedback.length === 0) {
      setSelectedId("");
      return;
    }
    if (!visibleFeedback.some((item) => item.id === selectedId)) {
      setSelectedId(visibleFeedback[0].id);
    }
  }, [selectedId, visibleFeedback]);

  const selectedFeedback = useMemo(
    () => feedback?.find((item) => item.id === selectedId) || null,
    [feedback, selectedId],
  );

  const selectFeedback = (feedbackId) => {
    setSelectedId(feedbackId);
    setError("");
    setMessage("");
  };

  const changeStatus = async (nextStatus) => {
    if (!selectedFeedback || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await base44.entities.UserFeedback.update(selectedFeedback.id, { status: nextStatus });
      await loadFeedback();
      setMessage(
        nextStatus === "reviewed"
          ? "Feedback-ul a fost marcat ca revizuit."
          : nextStatus === "archived"
            ? "Feedback-ul a fost arhivat."
            : "Feedback-ul a fost mutat inapoi in lista celor noi.",
      );
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error
          || requestError?.message
          || "Statusul feedback-ului nu a putut fi actualizat.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-admin-mobile="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Inbox} label="Feedback nou" value={counts.new} />
        <SummaryCard icon={CheckCircle2} label="Revizuit" value={counts.reviewed} />
        <SummaryCard icon={Archive} label="Arhivat" value={counts.archived} />
        <SummaryCard icon={MessageSquareText} label="Total feedback" value={counts.total} />
      </div>

      <AdminCard className="p-3 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
          <label className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cauta dupa mesaj, email, utilizator sau pagina"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
            {[
              ["new", `Noi (${counts.new})`],
              ["reviewed", `Revizuite (${counts.reviewed})`],
              ["archived", `Arhivate (${counts.archived})`],
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
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label>
              <span className="sr-only">Filtru evaluare</span>
              <select
                value={ratingFilter}
                onChange={(event) => setRatingFilter(event.target.value)}
                className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none"
              >
                <option value="all">Toate evaluarile</option>
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} din 5</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => loadFeedback()}
              disabled={loading || saving}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizeaza
            </button>
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

      {loading && !feedback && (
        <AdminCard className="flex min-h-52 items-center justify-center p-5 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se incarca feedback-ul...
        </AdminCard>
      )}

      {!loading && feedback?.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={MessageSquareText}
            title="Nu exista feedback trimis."
            subtitle="Evaluarile trimise din conturile utilizatorilor vor aparea automat aici."
          />
        </AdminCard>
      )}

      {feedback && feedback.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
              {visibleFeedback.length} rezultate
            </div>
            {visibleFeedback.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={Search}
                  title="Niciun feedback pentru filtrele selectate."
                  subtitle="Schimba filtrul sau termenul de cautare."
                />
              </div>
            ) : (
              <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {visibleFeedback.map((item) => {
                  const selected = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectFeedback(item.id)}
                      className={`w-full p-4 text-left transition ${
                        selected ? "bg-secondary/70" : "hover:bg-secondary/35"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Rating value={item.rating} compact />
                          <div className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
                            {item.message || "Feedback fara mesaj"}
                          </div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {item.user_email || "Email indisponibil"}
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <span>{ACCOUNT_MODE_LABELS[item.account_mode] || item.account_mode || "Cont"}</span>
                        <span>{formatDate(item.created_date)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            {!selectedFeedback ? (
              <EmptyState
                icon={MessageSquareText}
                title="Selecteaza un feedback."
                subtitle="Mesajul si contextul utilizatorului vor aparea aici."
              />
            ) : (
              <div className="space-y-5">
                <div className="border-b border-border pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={selectedFeedback.status} />
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                        {ACCOUNT_MODE_LABELS[selectedFeedback.account_mode]
                          || selectedFeedback.account_mode
                          || "Cont"}
                      </span>
                    </div>
                    <Rating value={selectedFeedback.rating} />
                  </div>
                  <h2 className="mt-4 font-heading text-xl font-extrabold">Feedback utilizator</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Trimis {formatDate(selectedFeedback.created_date)}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <UserRound className="h-4 w-4 text-muted-foreground" /> Utilizator
                    </div>
                    <div className="mt-3 break-all text-sm font-semibold">
                      {selectedFeedback.user_email || "Email indisponibil"}
                    </div>
                    <div className="mt-2 break-all text-[10px] text-muted-foreground">
                      User ID: {selectedFeedback.user_id || "—"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Clock3 className="h-4 w-4 text-muted-foreground" /> Context
                    </div>
                    <div className="mt-3 space-y-1 break-all text-xs text-muted-foreground">
                      <div>Sursa: {selectedFeedback.source || "—"}</div>
                      <div>Pagina: {selectedFeedback.page_path || "—"}</div>
                      {selectedFeedback.organization_id && (
                        <div>Organizatie: {selectedFeedback.organization_id}</div>
                      )}
                      {selectedFeedback.professional_profile_id && (
                        <div>Profil profesional: {selectedFeedback.professional_profile_id}</div>
                      )}
                    </div>
                  </div>
                </div>

                <article className="rounded-2xl border border-border bg-background p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    Mesajul utilizatorului
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {selectedFeedback.message || "Utilizatorul a trimis doar evaluarea numerica."}
                  </p>
                </article>

                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/20 p-4 sm:flex-row sm:flex-wrap">
                  {selectedFeedback.status !== "reviewed" && (
                    <button
                      type="button"
                      onClick={() => changeStatus("reviewed")}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Marcheaza revizuit
                    </button>
                  )}
                  {selectedFeedback.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => changeStatus("archived")}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" /> Arhiveaza
                    </button>
                  )}
                  {selectedFeedback.status !== "new" && (
                    <button
                      type="button"
                      onClick={() => changeStatus("new")}
                      disabled={saving}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" /> Muta la feedback nou
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
