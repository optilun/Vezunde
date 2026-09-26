// Zona de scriere a conversatiei controlate. Limita de 1200 de caractere si avertismentul
// despre datele de contact sunt aceleasi cu regulile validate in backend
// (controlledChatPolicy.validateControlledChatMessage) - aici doar le anuntam vizual.
import React, { useId, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";

export default function ChatComposer({ sending, disabled = false, onSend, onClose }) {
  const fieldId = useId();
  const pending = useRef(null);
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const busy = sending || submitting || disabled;
  const [value, setValue] = useState("");
  const tooShort = value.trim().length < 2;

  const submit = async (event) => {
    event.preventDefault();
    if (tooShort || busy || inFlight.current) return;
    const body = value.trim();
    if (!pending.current || pending.current.body !== body) {
      const id = typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}:${Math.random().toString(36).slice(2)}`;
      pending.current = { body, id: `chat:${id}` };
    }
    inFlight.current = true;
    setSubmitting(true);
    try {
      const sent = await onSend(body, pending.current.id);
      if (sent === true) { pending.current = null; setValue(""); }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-border bg-card p-3">
      <label htmlFor={fieldId} className="sr-only">Mesaj pentru această conversație</label>
      <textarea
        id={fieldId}
        aria-describedby={`${fieldId}-help`}
        disabled={busy}
        value={value}
        onChange={(event) => {
          if (pending.current?.body !== event.target.value.trim()) pending.current = null;
          setValue(event.target.value);
        }}
        maxLength={1200}
        rows={2}
        placeholder="Scrie un mesaj fara date de contact..."
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span id={`${fieldId}-help`} className="text-[10px] text-muted-foreground">{value.length}/1200 · Telefonul, emailul si linkurile sunt blocate.</span>
        <div className="flex gap-2">
          {onClose && (
            <button type="button" onClick={onClose} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground disabled:opacity-60">
              <X className="h-3.5 w-3.5" /> Inchide
            </button>
          )}
          <button type="submit" disabled={busy || tooShort} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background disabled:opacity-60">
            {sending || submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Trimite
          </button>
        </div>
      </div>
    </form>
  );
}