import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Loader2, RefreshCw } from "lucide-react";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationCenter({
  label = "Notificări",
  loadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  onOpenTarget,
  onDataChange,
  refreshIntervalMs = 60000,
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], counters: { total: 0, unread: 0 }, warning: "" });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const loadingRef = useRef(false);
  const lastLoadedAtRef = useRef(0);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setError("");
    try {
      const result = await loadNotifications();
      setData({
        notifications: Array.isArray(result?.notifications) ? result.notifications : [],
        counters: result?.counters || { total: 0, unread: 0 },
        warning: result?.warning || "",
      });
    } catch (loadError) {
      setData({ notifications: [], counters: { total: 0, unread: 0 }, warning: "" });
      setError(loadError?.message || "Notificările nu au putut fi încărcate.");
    } finally {
      loadingRef.current = false;
      lastLoadedAtRef.current = Date.now();
      setLoading(false);
    }
  }, [loadNotifications]);

  useEffect(() => {
    void load();
    if (refreshIntervalMs <= 0) return undefined;
    const interval = window.setInterval(() => void load(), refreshIntervalMs);
    return () => window.clearInterval(interval);
  }, [load, refreshIntervalMs]);

  useEffect(() => {
    onDataChange?.(data);
  }, [data, onDataChange]);

  const openNotification = async (notification) => {
    if (notification.status === "unread") {
      setUpdatingId(notification.id);
      try {
        await markNotificationRead(notification.id, notification);
        setData((current) => ({
          ...current,
          counters: {
            ...current.counters,
            unread: Math.max(0, Number(current.counters?.unread || 0) - 1),
          },
          notifications: current.notifications.map((item) => (
            item.id === notification.id ? { ...item, status: "read", read_at: new Date().toISOString() } : item
          )),
        }));
      } catch (markError) {
        setError(markError?.message || "Notificarea nu a putut fi actualizată.");
      } finally {
        setUpdatingId("");
      }
    }
    onOpenTarget?.(notification);
  };

  const markAll = async () => {
    setUpdatingId("all");
    setError("");
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setData((current) => ({
        ...current,
        counters: { ...current.counters, unread: 0 },
        notifications: current.notifications.map((item) => ({ ...item, status: "read", read_at: item.read_at || now })),
      }));
    } catch (markError) {
      await load();
      setError(markError?.message || "Notificările nu au putut fi actualizate.");
    } finally {
      setUpdatingId("");
    }
  };

  const unread = Number(data.counters?.unread || 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (!open && Date.now() - lastLoadedAtRef.current > 30000) void load();
          setOpen((value) => !value);
        }}
        className="relative inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground hover:bg-secondary"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {label}
        {unread > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-primary-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,430px)] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_22px_70px_rgba(23,23,23,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-extrabold text-foreground">{label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{unread} necitite</p>
              {refreshIntervalMs <= 0 && <p className="mt-0.5 text-[11px] text-muted-foreground">Actualizează manual pentru noutăți</p>}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => void load()} disabled={loading || Boolean(updatingId)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-50" aria-label="Actualizează notificările">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button type="button" onClick={() => void markAll()} disabled={unread === 0 || Boolean(updatingId)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary disabled:opacity-40" aria-label="Marchează toate notificările ca citite">
                {updatingId === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p role="alert" className="m-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
          {data.warning && <p role="status" className="m-3 rounded-xl border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900">{data.warning}</p>}

          <div className="max-h-[420px] overflow-y-auto p-2">
            {loading && data.notifications.length === 0 ? (
              <div className="flex min-h-28 items-center justify-center text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Se încarcă...</div>
            ) : data.notifications.length === 0 ? (
              <div className="p-6 text-center"><Bell className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-2 text-sm font-semibold text-foreground">Nu ai notificări</p></div>
            ) : (
              <div className="space-y-1">
                {data.notifications.map((notification) => {
                  const isUnread = notification.status === "unread";
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => void openNotification(notification)}
                      disabled={updatingId === notification.id}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-secondary disabled:opacity-60 ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      <span className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isUnread ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                        {updatingId === notification.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-extrabold text-foreground">{notification.title}</span>
                        {notification.location_name && <span className="mt-1 block text-[11px] font-semibold text-foreground/75">Locație: {notification.location_name}</span>}
                        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{notification.body}</span>
                        {formatDate(notification.created_date) && <span className="mt-1.5 block text-[10px] text-muted-foreground">{formatDate(notification.created_date)}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
