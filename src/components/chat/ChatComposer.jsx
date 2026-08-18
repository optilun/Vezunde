// Zona de scriere a conversatiei controlate. Limita de 1200 de caractere si avertismentul
// despre datele de contact sunt aceleasi cu regulile validate in backend
// (controlledChatPolicy.validateControlledChatMessage) - aici doar le anuntam vizual.
import React, { useState } from "react";
import { Loader2, Send, X } from "lucide-react";

export default function ChatComposer({ sending, onSend, onClose }) {
  const [value, setValue] = useState("");
  const tooShort = value.trim().length < 2;

  const submit = async (event) => {
    event.preventDefault();
    if (tooShort || sending) return;
    const sent = await onSend(value);
    if (sent !== false) setValue("");
  };

  return (
    <form onSubmit={submit} className="border-t border-border bg-card p-3">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={1200}
        rows={2}
        placeholder="Scrie un mesaj fara date de contact..."
        className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
      />
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[10px] text-muted-foreground">{value.length}/1200 · Telefonul, emailul si linkurile sunt blocate.</span>
        <div className="flex gap-2">
          {onClose && (
            <button type="button" onClick={onClose} disabled={sending} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-xs font-bold text-foreground disabled:opacity-60">
              <X className="h-3.5 w-3.5" /> Inchide
            </button>
          )}
          <button type="submit" disabled={sending || tooShort} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-bold text-background disabled:opacity-60">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Trimite
          </button>
        </div>
      </div>
    </form>
  );
}