import React, { useCallback, useEffect, useState } from "react";
import { Loader2, LockKeyhole, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import {
  createControlledChatMessageId,
  patientControlledChat,
} from "@/lib/patientRequestPersistenceClient";

const ELIGIBLE_RESPONSES = new Set(["can_help", "needs_details"]);

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function PatientRequestChat({ requestId, accessToken, locationId, locationName, responseType }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const invoke = useCallback((nextAction, values = {}) => patientControlledChat({
    requestId,
    locationId,
    action: nextAction,
    explicitAccessToken: accessToken || "",
    ...values,
  }), [accessToken, locationId, requestId]);

  const load = useCallback(async () => {
    if (!requestId || !locationId || !ELIGIBLE_RESPONSES.has(responseType)) return;
    setLoading(true);
    setError("");
    try {
      let next = await invoke("status");
      if (Number(next.chat?.unread_count) > 0) next = await invoke("mark_read");
      setData(next);
    } catch (loadError) {
      setError(loadError?.message || "Conversația nu a putut fi încărcată.");
    } finally {
      setLoading(false);
    }
  }, [invoke, locationId, requestId, responseType]);

  useEffect(() => { void load(); }, [load]);

  const open = async () => {
    setAction("open");
    setError("");
    try {
      setData(await invoke("open"));
    } catch (openError) {
      setError(openError?.message || "Conversația nu a putut fi deschisă.");
    } finally {
      setAction("");
    }
  };

  const send = async (event) => {
    event.preventDefault();
    if (message.trim().length < 2) return;
    setAction("send");
    setError("");
    try {
      const next = await invoke("send", {
        message,
        clientMessageId: createControlledChatMessageId(),
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

  if (!ELIGIBLE_RESPONSES.has(responseType)) return null;
  if (loading) return <div className="mt-4 flex min-h-16 items-center justify-center rounded-xl border border-border bg-secondary/25 text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificăm disponibilitatea chatului...</div>;
  if (!data?.chat?.can_open && data?.chat?.status === "not_opened" && !error) return null;

  const opened = data?.chat?.status === "open";
  const closed = data?.chat?.status === "closed";
  const messages = data?.messages || [];

  return (
    <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold text-foreground"><MessageCircle className="h-4 w-4 text-primary" /> Chat VIASEE cu {locationName || data?.location?.name || "locația"}</p>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">Conversația rămâne în VIASEE. Nu introduce telefon, email sau linkuri; aceste date sunt gestionate separat.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={Boolean(action)} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-[11px] font-bold text-foreground disabled:opacity-60"><RefreshCw className="h-3.5 w-3.5" /> Actualizează</button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}

      {data?.chat?.can_open && !opened && (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-semibold text-foreground">Tu controlezi deschiderea conversației.</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Locația nu îți poate scrie până când nu deschizi explicit chatul.</p>
          <button type="button" onClick={() => void open()} disabled={Boolean(action)} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background disabled:opacity-60">
            {action === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />} Deschide conversația
          </button>
        </div>
      )}

      {(opened || closed) && (
        <>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
            {messages.length === 0 ? <p className="py-5 text-center text-xs text-muted-foreground">Conversația este deschisă. Poți trimite primul mesaj.</p> : messages.map((item) => (
              <div key={item.id} className={`flex ${item.sender_type === "patient" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[86%] rounded-2xl px-3 py-2 ${item.sender_type === "patient" ? "bg-foreground text-background" : "bg-secondary text-foreground"}`}>
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{item.body}</p>
                  <p className={`mt-1 text-[9px] ${item.sender_type === "patient" ? "text-background/65" : "text-muted-foreground"}`}>{item.sender_type === "patient" ? "Tu" : locationName || "Locația"} · {formatTime(item.sent_at)}</p>
                </div>
              </div>
            ))}
          </div>

          {opened && data?.chat?.can_send && (
            <form onSubmit={send} className="mt-3">
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1200} rows={3} placeholder="Scrie un mesaj fără date de contact..." className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-[10px] text-muted-foreground">{message.length}/1200 · Telefonul, emailul și linkurile sunt blocate.</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void close()} disabled={Boolean(action)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground disabled:opacity-60"><X className="h-3.5 w-3.5" /> Închide</button>
                  <button type="submit" disabled={Boolean(action) || message.trim().length < 2} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60">{action === "send" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Trimite</button>
                </div>
              </div>
            </form>
          )}

          {closed && <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" /> Conversația este închisă. O poți redeschide cât timp locația rămâne eligibilă.</p>}
        </>
      )}
    </div>
  );
}
