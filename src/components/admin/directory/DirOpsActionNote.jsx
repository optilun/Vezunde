import React, { useEffect, useState } from "react";

export default function DirOpsActionNote({
  title,
  onConfirm,
  onCancel,
  noteOptional = false,
  children = null,
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const titleId = "directory-action-note-title";
  const noteId = "directory-action-note-value";

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onCancel]);

  const confirm = async () => {
    const normalizedNote = note.trim();
    if (!noteOptional && !normalizedNote) {
      setError("Completează motivul deciziei.");
      document.getElementById(noteId)?.focus();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onConfirm(normalizedNote);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error
          || requestError.message
          || "Decizia nu a putut fi aplicată.",
      );
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.();
      }}
    >
      <section
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h3 id={titleId} className="font-heading text-base font-bold leading-snug">
          {title}
        </h3>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-4">
          <label htmlFor={noteId} className="text-xs font-semibold text-foreground">
            {noteOptional ? "Notă internă (opțională)" : "Motivul deciziei"}
          </label>
          <textarea
            id={noteId}
            className="mt-2 min-h-28 w-full resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm"
            rows={4}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              if (error) setError(null);
            }}
            placeholder={noteOptional ? "Adaugă o notă pentru istoricul intern..." : "Scrie motivul care va fi înregistrat în audit..."}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {noteOptional
              ? "Poți continua fără notă."
              : "Nota este obligatorie și rămâne în istoricul administrativ."}
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
            {error}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-secondary px-4 text-sm font-semibold disabled:opacity-50 sm:rounded-lg"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40 sm:rounded-lg"
          >
            {busy ? "Se aplică..." : "Confirmă"}
          </button>
        </div>
      </section>
    </div>
  );
}
