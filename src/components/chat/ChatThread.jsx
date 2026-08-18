// Panoul de conversatie, comun pacientului si locatiei. Primeste TOTUL prin proprietati:
// nu cheama backendul si nu decide eligibilitatea - acelea rămân in ProviderLeadChat /
// PatientRequestChat, care vorbesc cu controlledChatOps. Asa arata identic pe ambele parti.
import React, { useEffect, useRef } from "react";
import { Loader2, LockKeyhole, MessageCircle, RefreshCw } from "lucide-react";
import ChatMessageBubble from "./ChatMessageBubble";
import ChatComposer from "./ChatComposer";

export default function ChatThread({
  title,
  hint,
  messages = [],
  meLabel,
  otherLabel,
  mineSenderType,
  loading = false,
  sending = false,
  error = "",
  emptyNote = "Conversatia nu conține mesaje.",
  lockedNote = "",
  footerNote = "",
  canSend = false,
  onSend,
  onClose,
  onRefresh,
  headerAction = null,
}) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-secondary/25">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-extrabold text-foreground">
            <MessageCircle className="h-4 w-4 text-primary" /> {title}
          </p>
          {hint && <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {onRefresh && (
            <button type="button" onClick={onRefresh} disabled={loading || sending} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-[11px] font-bold text-foreground disabled:opacity-60">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizeaza
            </button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="border-b border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive">{error}</p>}

      <div className="min-h-40 flex-1 space-y-2.5 overflow-y-auto px-4 py-4" style={{ maxHeight: "26rem" }}>
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se incarca conversatia...</p>
        ) : lockedNote ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><p>{lockedNote}</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{emptyNote}</p>
        ) : (
          messages.map((item) => (
            <ChatMessageBubble key={item.id} message={item} mine={item.sender_type === mineSenderType} meLabel={meLabel} otherLabel={otherLabel} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {canSend
        ? <ChatComposer sending={sending} onSend={onSend} onClose={onClose} />
        : footerNote && (
          <p className="inline-flex items-center gap-2 border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> {footerNote}
          </p>
        )}
    </section>
  );
}