import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Mail, MailWarning } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminRoute } from "@/components/admin/useAdminRoute";
import { relativeTime } from "@/lib/adminFormat";
import { FOCUS_REFRESH_MIN_INTERVAL_MS } from "@/lib/focusRefreshGate";

// 2026-10-10 (Alex: tot ce intră trebuie să mă anunțe în panoul de admin). Clopoțelul din antet:
// fiecare revendicare, locație nouă, modificare trimisă, specialist, sesizare, tichet, feedback sau
// cerere de pacient apare aici (AdminNotification, scris de base44/shared/adminNotifications.js) și
// pleacă și pe email. Se reîmprospătează la 60 s și când revii în fereastră, ca numerele din meniu.

const AUTO_REFRESH_MS = 60_000;

const CATEGORY_DOT = {
  provider: "bg-[#345bc8]",
  patient: "bg-[#a97825]",
  directory: "bg-[#735c80]",
  support: "bg-[#4d6b45]",
  system: "bg-muted-foreground",
};

function emailNote(item) {
  if (item.email_status === "sent") return null;
  if (item.email_status === "failed" || item.email_status === "partial") return { warn: true, text: "Emailul nu a plecat" };
  if (item.email_status === "skipped" && item.email_skip_reason === "hourly_limit") return { warn: false, text: "Fără email (prea multe într-o oră)" };
  if (item.email_status === "skipped" && item.email_skip_reason === "no_admin_recipients") return { warn: true, text: "Fără email: niciun cont de admin" };
  return null;
}

export default function AdminNotificationBell() {
  const { go } = useAdminRoute();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);
  const [marking, setMarking] = useState(false);
  const inFlight = useRef(false);
  const lastLoadAt = useRef(0);

  const load = useCallback(async ({ force = false } = {}) => {
    if (inFlight.current) return;
    if (!force && Date.now() - lastLoadAt.current < FOCUS_REFRESH_MIN_INTERVAL_MS) return;
    inFlight.current = true;
    try {
      const response = await base44.functions.invoke("adminNotificationOps", { action: "list" });
      const data = response?.data || {};
      if (data.error) throw new Error(data.error);
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(Number(data.unread_count) || 0);
      setFailed(false);
      lastLoadAt.current = Date.now();
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    load({ force: true });
    const timer = window.setInterval(() => load({ force: true }), AUTO_REFRESH_MS);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const markRead = async (ids) => {
    if (!ids.length) return;
    const readAt = new Date().toISOString();
    setItems((current) => (current || []).map((item) => (ids.includes(item.id) && !item.read_at ? { ...item, read_at: readAt } : item)));
    setUnread((current) => Math.max(0, current - ids.length));
    await base44.functions.invoke("adminNotificationOps", { action: "mark_read", ids }).catch(() => null);
  };

  const markAllRead = async () => {
    setMarking(true);
    try {
      await base44.functions.invoke("adminNotificationOps", { action: "mark_all_read" });
      await load({ force: true });
    } catch {
      setFailed(true);
    } finally {
      setMarking(false);
    }
  };

  const openItem = (item) => {
    if (!item.read_at) markRead([item.id]);
    setOpen(false);
    go(item.admin_section || "dashboard", item.admin_tab || "");
  };

  const badge = unread > 99 ? "99+" : String(unread);
  const label = unread > 0 ? `Anunțuri: ${unread} necitite` : "Anunțuri";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-secondary active:bg-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-[#b42318] px-1 text-[10px] font-bold leading-[1.125rem] text-white tabular-nums">
              {badge}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Anunțuri</p>
            <p className="text-xs text-muted-foreground">Tot ce a intrat și așteaptă o decizie.</p>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            disabled={marking || unread === 0}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Marchează citite
          </button>
        </div>

        <div className="max-h-[min(28rem,70vh)] overflow-y-auto">
          {items === null && !failed && <p className="px-4 py-6 text-sm text-muted-foreground">Se încarcă…</p>}
          {failed && (
            <div className="px-4 py-6 text-sm">
              <p className="text-muted-foreground">Anunțurile nu s-au putut încărca.</p>
              <button type="button" onClick={() => load({ force: true })} className="mt-2 text-xs font-semibold underline underline-offset-4">
                Încearcă din nou
              </button>
            </div>
          )}
          {items !== null && !failed && items.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nimic nou. Când cineva trimite ceva, apare aici și primești email.</p>
          )}
          {items !== null && !failed && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const note = emailNote(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none ${item.read_at ? "" : "bg-secondary/40"}`}
                    >
                      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-transparent ring-1 ring-border" : CATEGORY_DOT[item.category] || CATEGORY_DOT.system}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${item.read_at ? "font-medium text-muted-foreground" : "font-semibold text-foreground"}`}>
                          {item.title}
                          {!item.read_at && <span className="sr-only"> (necitit)</span>}
                        </span>
                        {item.details && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{item.details}</span>}
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{relativeTime(item.created_date)}</span>
                          {note && (
                            <span className={`inline-flex items-center gap-1 ${note.warn ? "text-[#b42318]" : ""}`}>
                              {note.warn ? <MailWarning className="h-3 w-3" aria-hidden="true" /> : <Mail className="h-3 w-3" aria-hidden="true" />}
                              {note.text}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
