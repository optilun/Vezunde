import React, { useState } from "react";

export default function DirOpsActionNote({ title, onConfirm, onCancel, noteOptional = false, children }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(note.trim());
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg p-5 w-full max-w-md border border-border">
        <h3 className="font-heading font-bold text-sm">{title}</h3>
        {children && <div className="mt-4">{children}</div>}
        <textarea
          className="w-full border border-input rounded-md px-3 py-2 text-sm mt-3 bg-card"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motivul deciziei (inregistrat in audit)"
        />
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-md bg-secondary text-sm">Anuleaza</button>
          <button onClick={confirm} disabled={busy || (!noteOptional && !note.trim())} className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
            {busy ? "Se aplica..." : "Confirma"}
          </button>
        </div>
      </div>
    </div>
  );
}
