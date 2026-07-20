import React, { useCallback, useEffect, useState } from "react";
import { Loader2, LockKeyhole, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const ELIGIBLE_RESPONSES = new Set(["can_help", "needs_details"]);

function responseData(response) {
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

function createMessageId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `chat:${globalThis.crypto.randomUUID()}`;
  return `chat:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function ProviderLeadChat({ leadId, locationId, enabled, responseType, terminal = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const invoke = useCallback(async (nextAction, values = {}) => {
    const response = await base44.functions.invoke("controlledChatOps", {
      actor: "provider",
      action: nextAction,
      location_id: locationId,
      lead_id: leadId,
      ...values,
    });
    return responseData(response);
  }, [leadId, locationId]);

  const load = useCallback(async () => {
    if (!enabled || !ELIGIBLE_RESPONSES.has(responseType)) return;
    setLoading(true);
    setError("");
    try {
      let next = await invoke("status");
      if (!terminal && Number(next.chat?.unread_count) > 0) next = await invoke("mark_read");
      setData(next);
    } catch (loadError) {
      setError(loadError?.message || "Conversația nu a putut fi încărcată.");
    } finally {
      setLoading(false);
    }
  }, [enabled, invoke, responseType, terminal]);

  useEffect(() => { void load(); }, [load]);

  const send = async (event) => {
    event.preventDefault();
    if (terminal || message.trim().length < 2) return;
    setAction("send");
    setError("");
    try {
      const next = await invoke("send", {
        message,
        client_message_id: createMessageId(),
      });
      setData(next);
      setMessage("");
    } catch (sendError) {
      setError(sendError?.message || "Mesajul nu a putut fi trimis.");
    } finally {
      setAction("");
    }
  };

  const close = async () => {
    if (terminal) return;
    setAction("close");
    setError("");
    try {
      setData(await invoke("close"));
    } catch (closeError) {
      setError(closeError?.message || "Conversația nu a putut fi închisă.");
    } finally {
      setAction("");
    }
  };

  if (!enabled || !ELIGIBLE_RESPONSES.has(responseType)) return null;
  if (loading) return <div className="mt-5 flex min-h-16 items-center justify-center rounded-xl border border-border bg-secondary/25 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificăm chatul...</div>;

  const opened = data?.chat?.status === "open";
  const closed = data?.chat?.status === "closed";
  const messages = data?.messages || [];

  if (terminal && !opened && !closed) {
    return (
      <div className="mt-5 rounded-xl border border-border bg-secondary/25 p-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Cererea este încheiată și nu a existat o conversație VIASEE pentru acest lead.</span>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground"><MessageCircle className="h-4 w-4 text-primary" /> {terminal ? "Istoric chat VIASEE · Pro" : "Chat VIASEE · Pro"}</p>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            {terminal
              ? "Conversația este disponibilă numai pentru consultare. Datele de contact rămân blocate."
              : "Clientul deschide conversația. Telefonul, emailurile și linkurile sunt blocate în mesaje."}
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={Boolean(action)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-[11px] font-bold text-foreground disabled:opacity-60"><RefreshCw className="h-3.5 w-3.5" /> Actualizează</button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}

      {!terminal && !opened && !closed && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Clientul nu a deschis încă această conversație. Locația nu poate iniția chatul unilateral.</p>
        </div>
      )}

      {(opened || closed) && (
        <>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
            {messages.length === 0 ? <p className="py-5 text-center text-xs text-muted-foreground">Conversația nu conține mesaje.</p> : messages.map((item) => (
              <div key={item.id} className={`flex ${item.sender_type === "provider" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[86%] rounded-2xl px-3 py-2 ${item.sender_type === "provider" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}>
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{item.body}</p>
                  <p className={`mt-1 text-[9px] ${item.sender_type === "provider" ? "text-background/65" : "text-muted-foreground"}`}>{item.sender_type === "provider" ? "Locația" : "Client"} · {formatTime(item.sent_at)}</p>
                </div>
              </div>
            ))}
          </div>

          {!terminal && opened && data?.chat?.can_send && (
            <form onSubmit={send} className="mt-3">
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} rows={3} placeholder="Scrie un mesaj fără date de contact..." className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] text-muted-foreground">{message.length}/1200 · Nu solicita și nu introduce date de contact în chat.</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void close()} disabled={Boolean(action)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground disabled:opacity-60"><X className="h-3.5 w-3.5" /> Închide</button>
                  <button type="submit" disabled={Boolean(action) || message.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60">{action === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Trimite</button>
                </div>
              </div>
            </form>
          )}

          {(terminal || closed) && <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> {terminal ? "Cererea este încheiată. Istoricul rămâne numai pentru consultare." : "Conversația este închisă. Clientul o poate redeschide dacă leadul rămâne eligibil."}</p>}
        </>
      )}
    </div>
  );
}
