import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { openMyPatientRequest } from "@/lib/openMyPatientRequest";
import { readableErrorMessage } from "@/lib/transientRetry";

// 2026-10-04 (structura conturilor, pasul 5). „Notificări” în contul personal: actualizările
// tuturor cererilor trimise din cont (răspunsuri, mesaje, expirare). Sunt aceleași notificări ca în
// pagina cererii, deci „citit” aici înseamnă „citit” și acolo.

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

async function notificationsOps(action, payload = {}) {
  try {
    const response = await base44.functions.invoke("myPatientNotificationsOps", { action, ...payload });
    const data = response?.data || {};
    if (data.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(readableErrorMessage(error?.response?.data?.error || error?.message, "Notificările nu au putut fi încărcate."));
  }
}

export default function PersonalNotifications() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: "", notifications: [], unread: 0, truncated: false });
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await notificationsOps("list");
      setState({ loading: false, error: "", notifications: data.notifications || [], unread: data.counters?.unread || 0, truncated: data.truncated === true });
    } catch (error) {
      setState({ loading: false, error: error.message, notifications: [], unread: 0, truncated: false });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const open = async (notification) => {
    if (busy) return;
    setBusy(notification.id);
    setActionError("");
    try {
      if (notification.status === "unread") await notificationsOps("mark_read", { notification_id: notification.id }).catch(() => null);
      navigate(await openMyPatientRequest(notification.request_id));
    } catch (error) {
      setActionError(error.message);
      setBusy("");
    }
  };

  const markAllRead = async () => {
    if (busy) return;
    setBusy("all");
    setActionError("");
    try {
      await notificationsOps("mark_all_read");
      await load();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary"><Bell className="h-4 w-4" /></div>
            <div>
              <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">Notificări</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Răspunsurile și mesajele primite la cererile tale, într-un singur loc.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} disabled={state.loading || Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-60">
              <RefreshCw className="h-4 w-4" /> Actualizează
            </button>
            {state.unread > 0 && (
              <button type="button" onClick={() => void markAllRead()} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-60">
                {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Marchează toate ca citite
              </button>
            )}
          </div>
        </div>
      </section>

      {actionError && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</div>}

      <div className="space-y-3">
        {state.loading && <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Se încarcă notificările...</div>}
        {!state.loading && state.error && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">{state.error}</div>}
        {!state.loading && !state.error && state.notifications.length === 0 && (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Nu ai notificări. Când o optică sau o clinică răspunde la o cerere trimisă din acest cont, apare aici.
          </div>
        )}
        {!state.loading && state.notifications.map((notification) => {
          const unread = notification.status === "unread";
          return (
            <article key={notification.id} className={`rounded-[20px] border p-4 shadow-sm sm:p-5 ${unread ? "border-foreground/25 bg-card" : "border-border bg-card/70"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-foreground" aria-label="Necitită" />}
                    <h2 className="break-words text-sm font-bold">{notification.title || "Actualizare"}</h2>
                  </div>
                  {notification.body && <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{notification.body}</p>}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {[notification.request_label, notification.request_reference ? `Referință ${notification.request_reference}` : "", formatDate(notification.created_date)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button type="button" onClick={() => void open(notification)} disabled={Boolean(busy)} className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold hover:bg-secondary disabled:opacity-60 sm:w-auto">
                  {busy === notification.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Deschide cererea {busy === notification.id ? null : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </article>
          );
        })}
        {state.truncated && <p className="px-1 text-xs text-muted-foreground">Sunt afișate cele mai noi 100 de notificări.</p>}
      </div>
    </div>
  );
}
