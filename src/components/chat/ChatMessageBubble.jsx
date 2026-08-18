// Bula de mesaj a conversatiei controlate VIASEE. Strat pur de prezentare: nu decide
// cine poate scrie, doar cum arata un mesaj deja livrat de controlledChatOps.
import React from "react";

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default function ChatMessageBubble({ message, mine, meLabel, otherLabel }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-[0_1px_2px_rgba(23,23,23,0.06)] ${mine ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md border border-border bg-card text-foreground"}`}>
        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{message.body}</p>
        <p className={`mt-1.5 text-[10px] ${mine ? "text-background/60" : "text-muted-foreground"}`}>
          {mine ? meLabel : otherLabel} · {formatTime(message.sent_at)}
        </p>
      </div>
    </div>
  );
}