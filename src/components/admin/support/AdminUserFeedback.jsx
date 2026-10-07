import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCircle2, Loader2, MessageSquareText, RotateCcw, Search, Star } from "lucide-react";
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
import AdminLoading from "@/components/admin/ui/AdminLoading";
import AdminNotice from "@/components/admin/ui/AdminNotice";
import EmptyState from "@/components/admin/ui/EmptyState";
import StatusBadge from "@/components/admin/ui/StatusBadge";
import { useAdminCounts } from "@/components/admin/useAdminCounts";
import { fullDateTime, plural, relativeTime } from "@/lib/adminFormat";
import { accountModeLabel, feedbackStatusLabel, feedbackStatusTone } from "@/lib/adminLabels";
import { matchesAllTokens, normalizeSearch, searchTokens } from "@/lib/adminSearch";

// Feedback de la utilizatori (2026-10-07): se deschide pe „Noi”; după ce marchezi un mesaj ca
// revizuit sau îl arhivezi, trecem singuri la următorul mesaj nou.
const LOAD_LIMIT = 500;
const feedbackStatusOf = (item) => item?.status || "new";

function Rating({ value, compact = false }) {
  const normalized = Math.max(1, Math.min(5, Number(value) || 1));
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Evaluare ${normalized} din 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${index < normalized ? "fill-warning text-warning" : "text-border"}`}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 text-[11px] font-semibold text-muted-foreground">{normalized}/5</span>
    </div>
  );
}

function FeedbackRow({ item, selected, onSelect }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        aria-current={selected ? "true" : undefined}
        className={`block w-full border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
          selected ? "border-foreground bg-secondary/70" : "border-transparent hover:bg-secondary/40"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <Rating value={item.rating} compact />
          <StatusBadge label={feedbackStatusLabel(item.status)} tone={feedbackStatusTone(item.status)} />
        </div>
        <div className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">
          {item.message || "Doar evaluare, fără mesaj"}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{item.user_email || "Email indisponibil"}</div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{accountModeLabel(item.account_mode)}</span>
          <span title={fullDateTime(item.created_date)}>{relativeTime(item.created_date)}</span>
        </div>
      </button>
    </li>
  );
}

function FeedbackDetail({ item, saving, onChangeStatus }) {
  const status = feedbackStatusOf(item);
  const actionButton = (nextStatus, label, Icon, { primary = false } = {}) => (
    <button
      type="button"
      onClick={() => onChangeStatus(nextStatus)}
      disabled={Boolean(saving)}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:opacity-50 ${
        primary ? "bg-foreground text-background hover:bg-foreground/90" : "border border-border bg-card hover:bg-secondary"
      }`}
    >
      {saving === nextStatus ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={feedbackStatusLabel(item.status)} tone={feedbackStatusTone(item.status)} />
            <StatusBadge label={accountModeLabel(item.account_mode)} />
          </div>
          <Rating value={item.rating} />
        </div>
        <h2 className="mt-3 font-heading text-xl font-extrabold">Feedback de la utilizator</h2>
        <p className="mt-1 text-xs text-muted-foreground" title={fullDateTime(item.created_date)}>
          Trimis {relativeTime(item.created_date)}
        </p>
      </div>

      <article className="rounded-2xl border border-border bg-background p-4">
        <div className="text-xs font-semibold text-muted-foreground">Mesajul utilizatorului</div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {item.message || "Utilizatorul a trimis doar evaluarea numerică."}
        </p>
      </article>

      <div className="grid gap-3 rounded-2xl border border-border bg-secondary/25 p-4 sm:grid-cols-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">De la</div>
          <div className="mt-1 text-sm font-semibold"><EmailLink email={item.user_email} /></div>
        </div>
        <SupportContext
          source={item.source}
          pagePath={item.page_path}
          organizationId={item.organization_id}
          professionalProfileId={item.professional_profile_id}
          userId={item.user_id}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {status !== "reviewed" && actionButton("reviewed", "Marchează revizuit", CheckCircle2, { primary: true })}
        {status !== "archived" && actionButton("archived", "Arhivează", Archive)}
        {status !== "new" && actionButton("new", "Mută la nou", RotateCcw, { primary: status === "archived" || status === "reviewed" })}
      </div>
    </div>
  );
}

export default function AdminUserFeedback() {
  const { refresh: refreshCounts } = useAdminCounts();
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [statusFilter, setStatusFilter] = useState("new");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState("");
  const [saveError, setSaveError] = useState("");
  const [flash, setFlash] = useState("");
  const loadSeq = useRef(0);
  const detailRef = useRef(null);
  const scrollToDetail = useScrollToDetail(detailRef);

  const loadFeedback = useCallback(async () => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setLoadError("");
    try {
      const rows = (await base44.entities.UserFeedback.list("-created_date", LOAD_LIMIT)) || [];
      if (seq === loadSeq.current) setFeedback(rows);
      return rows;
    } catch (requestError) {
      if (seq === loadSeq.current) {
        setLoadError(requestError?.response?.data?.error || requestError?.message || "Feedback-ul nu a putut fi încărcat.");
      }
      return null;
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => { loadFeedback(); }, [loadFeedback]);

  const searchText = useMemo(() => new Map((feedback || []).map((item) => [item.id, normalizeSearch([
    item.message,
    item.user_email,
    accountModeLabel(item.account_mode),
    item.page_path,
  ].filter(Boolean).join(" "))])), [feedback]);

  const counts = useMemo(() => {
    const rows = feedback || [];
    const byStatus = (status) => rows.filter((item) => feedbackStatusOf(item) === status).length;
    return { new: byStatus("new"), reviewed: byStatus("reviewed"), archived: byStatus("archived"), total: rows.length };
  }, [feedback]);

  const visibleFeedback = useMemo(() => {
    const tokens = searchTokens(query);
    return (feedback || []).filter((item) => {
      if (statusFilter !== "all" && feedbackStatusOf(item) !== statusFilter) return false;
      if (ratingFilter !== "all" && Number(item.rating) !== Number(ratingFilter)) return false;
      return tokens.length === 0 || matchesAllTokens(searchText.get(item.id) || "", tokens);
    });
  }, [feedback, query, ratingFilter, searchText, statusFilter]);

  useEffect(() => {
    if (!feedback) return;
    if (visibleFeedback.length === 0) {
      setSelectedId("");
    } else if (!visibleFeedback.some((item) => item.id === selectedId)) {
      setSelectedId(visibleFeedback[0].id);
    }
  }, [feedback, selectedId, visibleFeedback]);

  const selectedItem = useMemo(
    () => feedback?.find((item) => item.id === selectedId) || null,
    [feedback, selectedId],
  );

  const selectItem = (id) => {
    setSelectedId(id);
    setSaveError("");
    setFlash("");
    scrollToDetail();
  };

  const changeStatus = async (nextStatus) => {
    if (!selectedItem || saving) return;
    const itemId = selectedItem.id;
    // În lista „Noi”, după ce rezolvi un mesaj trecem la următorul nou; în rest rămânem pe cel curent.
    const advanceTo = statusFilter === "new" && nextStatus !== "new"
      ? visibleFeedback.find((item) => item.id !== itemId)?.id || ""
      : "";
    setSaving(nextStatus);
    setSaveError("");
    setFlash("");
    try {
      await base44.entities.UserFeedback.update(itemId, { status: nextStatus });
      const rows = await loadFeedback();
      refreshCounts();
      setFlash({
        reviewed: "Mesajul este marcat ca revizuit.",
        archived: "Mesajul este arhivat.",
        new: "Mesajul a fost mutat înapoi la cele noi.",
      }[nextStatus] || "Modificarea a fost salvată.");
      if (advanceTo && rows?.some((item) => item.id === advanceTo)) {
        setSelectedId(advanceTo);
        scrollToDetail();
      }
    } catch (requestError) {
      setSaveError(requestError?.response?.data?.error || requestError?.message || "Starea mesajului nu a putut fi schimbată.");
    } finally {
      setSaving("");
    }
  };

  const chips = [
    { key: "new", label: "Noi", count: counts.new },
    { key: "reviewed", label: "Revizuite", count: counts.reviewed },
    { key: "archived", label: "Arhivate", count: counts.archived },
    { key: "all", label: "Toate", count: counts.total },
  ];
  const filtering = Boolean(query.trim()) || ratingFilter !== "all";
  const capped = Boolean(feedback) && feedback.length >= LOAD_LIMIT;

  return (
    <div className="space-y-4" data-admin-mobile="true">
      <AdminCard className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SupportSearchField
            value={query}
            onChange={setQuery}
            label="Caută în feedback"
            placeholder="Caută după mesaj, email sau pagină"
          />
          <RefreshButton onClick={loadFeedback} busy={loading && Boolean(feedback)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminChips options={chips} value={statusFilter} onChange={setStatusFilter} label="Filtrează feedback-ul" />
          <FilterSelect value={ratingFilter} onChange={setRatingFilter} label="Filtrează după evaluare">
            <option value="all">Toate evaluările</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>{value} din 5</option>
            ))}
          </FilterSelect>
        </div>
      </AdminCard>

      {loadError && <AdminNotice tone="danger">{loadError}</AdminNotice>}
      {saveError && <AdminNotice tone="danger" onDismiss={() => setSaveError("")}>{saveError}</AdminNotice>}
      {flash && <AdminNotice tone="success" onDismiss={() => setFlash("")}>{flash}</AdminNotice>}
      {capped && (
        <AdminNotice tone="warning">
          Se afișează cele mai recente {LOAD_LIMIT} de mesaje; numerele de pe filtre se referă la ele.
        </AdminNotice>
      )}

      {!feedback && loading && <AdminLoading label="Se încarcă feedback-ul…" />}

      {!feedback && !loading && loadError && (
        <AdminCard className="p-5">
          <EmptyState icon={MessageSquareText} title="Feedback-ul nu s-a putut încărca." subtitle="Verifică conexiunea și încearcă din nou." ctaLabel="Încearcă din nou" onCta={loadFeedback} />
        </AdminCard>
      )}

      {feedback && feedback.length === 0 && (
        <AdminCard className="p-5">
          <EmptyState
            icon={MessageSquareText}
            title="Nu ai primit încă feedback."
            subtitle="Evaluările trimise din conturile utilizatorilor apar aici, singure."
          />
        </AdminCard>
      )}

      {feedback && feedback.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.5fr)]">
          <AdminCard className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
              {plural(visibleFeedback.length, "mesaj", "mesaje")}
            </div>
            {visibleFeedback.length === 0 ? (
              <div className="p-5">
                {statusFilter === "new" && !filtering ? (
                  <EmptyState
                    icon={MessageSquareText}
                    title="Nu ai mesaje noi."
                    subtitle="Le-ai citit pe toate."
                    ctaLabel="Vezi toate mesajele"
                    onCta={() => setStatusFilter("all")}
                  />
                ) : (
                  <EmptyState
                    icon={Search}
                    title="Niciun mesaj pentru filtrele alese."
                    ctaLabel="Șterge filtrele"
                    onCta={() => { setQuery(""); setRatingFilter("all"); setStatusFilter("all"); }}
                  />
                )}
              </div>
            ) : (
              <ul aria-label="Mesaje de feedback" className="max-h-[70vh] divide-y divide-border overflow-y-auto">
                {visibleFeedback.map((item) => (
                  <FeedbackRow key={item.id} item={item} selected={item.id === selectedId} onSelect={selectItem} />
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard className="p-4 sm:p-5">
            <div ref={detailRef} className="scroll-mt-20" />
            {!selectedItem ? (
              <EmptyState icon={MessageSquareText} title="Alege un mesaj din listă." subtitle="Mesajul și contextul apar aici." />
            ) : (
              <FeedbackDetail item={selectedItem} saving={saving} onChangeStatus={changeStatus} />
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
