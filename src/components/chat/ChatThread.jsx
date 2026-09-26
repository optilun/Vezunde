// Panoul de conversatie, comun pacientului si locatiei. Primeste TOTUL prin proprietati:
// nu cheama backendul si nu decide eligibilitatea - acelea rămân in ProviderLeadChat /
// PatientRequestChat, care vorbesc cu controlledChatOps. Asa arata identic pe ambele parti.
import React, { useLayoutEffect, useRef, useState } from "react";
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
  loadingOlder = false,
  hasOlder = false,
  onLoadOlder,
  error = "",
  emptyNote = "Conversatia nu conține mesaje.",
  lockedNote = "",
  footerNote = "",
  canSend = false,
  lastOwnMessageSeen = false,
  onSend,
  onClose,
  onRefresh,
  headerAction = null,
}) {
  const listRef = useRef(null);
  const position = useRef({ first: null, last: null, height: 0, top: 0, nearBottom: true });
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const firstId = messages[0]?.id;
  const lastId = messages[messages.length - 1]?.id;
  useLayoutEffect(() => {
    const node = listRef.current;
    if (!node) return;
    const previous = position.current;
    const prepended = previous.first && previous.first !== firstId && previous.last === lastId;
    if (prepended) {
      node.scrollTop = previous.top + node.scrollHeight - previous.height;
    } else if (!previous.last || previous.nearBottom) {
      node.scrollTop = node.scrollHeight;
      setHasNewMessages(false);
    } else if (previous.last !== lastId) {
      setHasNewMessages(true);
    }
    position.current = {
      first: firstId, last: lastId, height: node.scrollHeight, top: node.scrollTop,
      nearBottom: node.scrollHeight - node.scrollTop - node.clientHeight < 48,
    };
  }, [firstId, lastId, messages.length]);

  const trackScroll = () => {
    const node = listRef.current;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48;
    position.current = { ...position.current, top: node.scrollTop, height: node.scrollHeight, nearBottom };
    if (nearBottom) setHasNewMessages(false);
  };

  // Indicatorul "Vazut" se afiseaza o singura data, sub ultimul mesaj trimis de mine:
  // ca in aplicatiile de mesagerie, nu are sens repetat pe fiecare bula.
  let lastOwnIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.sender_type === mineSenderType) {
      lastOwnIndex = index;
      break;
    }
  }

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

      {hasOlder && (
        <button type="button" onClick={onLoadOlder} disabled={loading || loadingOlder || sending} className="min-h-10 border-b border-border px-4 text-xs font-bold disabled:opacity-60">
          {loadingOlder ? "Se încarcă istoricul..." : "Încarcă mesaje mai vechi"}
        </button>
      )}
      <div ref={listRef} role="log" aria-label={title} aria-live="polite" aria-relevant="additions" aria-busy={loading || loadingOlder} tabIndex={0} onScroll={trackScroll} className="min-h-40 flex-1 space-y-2.5 overflow-y-auto px-4 py-4" style={{ maxHeight: "26rem" }}>
        {loading && messages.length === 0 ? (
          <p className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Se incarca conversatia...</p>
        ) : lockedNote ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" /><p>{lockedNote}</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{emptyNote}</p>
        ) : (
          messages.map((item, index) => (
            <React.Fragment key={item.id}>
              <ChatMessageBubble message={item} mine={item.sender_type === mineSenderType} meLabel={meLabel} otherLabel={otherLabel} />
              {lastOwnMessageSeen && index === lastOwnIndex && (
                <p className="pr-1 text-right text-[10px] font-medium text-muted-foreground">{mineSenderType === "patient" ? "Citit de echipa locației" : "Citit de client"}</p>
              )}
            </React.Fragment>
          ))
        )}

      </div>

      {hasNewMessages && <button type="button" className="min-h-10 border-t border-border text-xs font-bold" onClick={() => { listRef.current.scrollTop = listRef.current.scrollHeight; trackScroll(); }}>Mesaje noi · Mergi la final</button>}

      {canSend
        ? <ChatComposer disabled={loading} sending={sending} onSend={onSend} onClose={onClose} />
        : footerNote && (
          <p className="inline-flex items-center gap-2 border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5 shrink-0" /> {footerNote}
          </p>
        )}
    </section>
  );
}