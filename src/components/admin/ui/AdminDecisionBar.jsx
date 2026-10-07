import React, { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Bara de decizie comună pentru cozile de verificare (2026-10-07).
//
// Înainte, fiecare card avea o casetă mare pentru notă și trei butoane, iar o eroare apărea sus în
// pagină, departe de butonul apăsat. Acum:
//  - „Aprobă” se face dintr-un click (nota rămâne opțională, în spatele lui „+ Notă”);
//  - acțiunile care cer motiv („Cere informații”, „Respinge”) deschid sub butoane un câmp pentru motiv,
//    cu validare locală, fără drum inutil la server;
//  - eroarea apare chiar sub butoane; Esc închide câmpul.
//
// actions: [{ key, label, icon?, tone?: "primary"|"neutral"|"danger", note?: "none"|"optional"|"required",
//             minNote?, noteLabel?, notePlaceholder?, noteRequiredMessage?, confirmLabel? }]
// onDecide(key, note): promisiune; dacă aruncă, mesajul apare sub butoane.
// validate(key, note): mesaj (string) dacă decizia nu poate porni încă; altfel null.
const BUTTON_TONES = {
  primary: "border-foreground bg-foreground text-background hover:bg-foreground/90",
  neutral: "border-border bg-card text-foreground hover:bg-secondary",
  danger: "border-danger-border bg-card text-danger hover:bg-danger-soft",
  ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
};

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10";

function errorText(error) {
  return error?.response?.data?.error || error?.message || "Decizia nu a putut fi aplicată.";
}

export default function AdminDecisionBar({
  actions,
  secondaryActions = [],
  onDecide,
  validate = undefined,
  busy = false,
  stack = false,
  className = "",
}) {
  const uid = useId();
  const noteId = `${uid}-note`;
  const errorId = `${uid}-error`;
  const [pendingKey, setPendingKey] = useState(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(null);
  const textareaRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => {
    if (pendingKey) textareaRef.current?.focus();
  }, [pendingKey]);

  const everyAction = [...actions, ...secondaryActions];
  const pending = everyAction.find((action) => action.key === pendingKey) || null;
  const pendingIsSecondary = Boolean(pending) && secondaryActions.some((action) => action.key === pending.key);
  const hasOptionalNote = actions.some((action) => action.note === "optional");
  const disabled = busy || running !== null;
  const panelOpen = Boolean(pending) || noteOpen;

  const reset = () => {
    setPendingKey(null);
    setNoteOpen(false);
    setNote("");
    setError("");
  };

  const execute = async (action, text) => {
    const min = action.note === "required" ? Math.max(1, action.minNote || 1) : 0;
    if (text.length < min) {
      setError(min > 1
        ? `Scrie o notă de cel puțin ${min} de caractere (acum ${text.length}).`
        : action.noteRequiredMessage || "Scrie mai întâi motivul.");
      textareaRef.current?.focus();
      return;
    }
    const problem = validate?.(action.key, text);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setRunning(action.key);
    try {
      await onDecide(action.key, text);
      if (mounted.current) reset();
    } catch (requestError) {
      if (mounted.current) setError(errorText(requestError));
    } finally {
      if (mounted.current) setRunning(null);
    }
  };

  const choose = (action) => {
    if (disabled) return;
    setError("");
    if (action.note === "required") {
      setNoteOpen(false);
      setPendingKey(action.key);
      textareaRef.current?.focus();
      return;
    }
    // Acțiune fără motiv obligatoriu: dacă era deschis câmpul altei acțiuni, motivul acela nu se
    // trimite aici.
    const text = !pendingKey && noteOpen ? note.trim() : "";
    if (pendingKey) {
      setPendingKey(null);
      setNote("");
    }
    execute(action, text);
  };

  const renderButton = (action, { secondary = false } = {}) => {
    const Icon = action.icon;
    const selected = pendingKey === action.key;
    const tone = secondary ? "ghost" : action.tone || "neutral";
    return (
      <button
        key={action.key}
        type="button"
        data-decision-action={action.key}
        aria-expanded={action.note === "required" ? selected : undefined}
        disabled={disabled}
        onClick={() => choose(action)}
        className={cn(BUTTON_BASE, BUTTON_TONES[tone], selected && "ring-2 ring-foreground/20", stack && "w-full", secondary && "min-h-9 px-3 sm:min-h-9")}
      >
        {running === action.key
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          : Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {action.label}
      </button>
    );
  };

  const panel = panelOpen && (
    <div
      className="rounded-xl border border-border bg-secondary/30 p-3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !disabled) {
          event.stopPropagation();
          reset();
        }
      }}
    >
      <label htmlFor={noteId} className="text-xs font-semibold text-foreground">
        {pending ? (pending.noteLabel || "Motivul deciziei") : "Notă internă (opțională)"}
        {pending && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      <textarea
        id={noteId}
        ref={textareaRef}
        rows={3}
        value={note}
        onChange={(event) => { setNote(event.target.value); if (error) setError(""); }}
        placeholder={pending?.notePlaceholder || (pending ? "Scrie motivul. Rămâne în istoricul administrativ." : "Rămâne în istoricul administrativ.")}
        aria-required={pending ? "true" : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className="mt-1.5 w-full resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-base outline-none focus:border-foreground/40 sm:text-sm"
      />
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={reset}
          className={cn(BUTTON_BASE, BUTTON_TONES.neutral, "min-h-10 sm:min-h-9")}
        >
          {pending ? "Anulează" : "Ascunde nota"}
        </button>
        {pending && (
          <button
            type="button"
            data-decision-confirm={pending.key}
            disabled={disabled}
            onClick={() => execute(pending, note.trim())}
            className={cn(BUTTON_BASE, BUTTON_TONES[pendingIsSecondary ? "neutral" : pending.tone || "primary"], "min-h-10 sm:min-h-9")}
          >
            {running === pending.key && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {pending.confirmLabel || pending.label}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-3", className)} data-admin-decision="true">
      {actions.length > 0 && (
        <div className={cn("flex gap-2", stack ? "flex-col" : "flex-wrap items-center")}>
          {actions.map((action) => renderButton(action))}
          {hasOptionalNote && !pending && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => { setNoteOpen((open) => !open); setError(""); }}
              aria-expanded={noteOpen}
              className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {noteOpen ? "Fără notă" : "+ Notă"}
            </button>
          )}
        </div>
      )}
      {!pendingIsSecondary && panel}
      {secondaryActions.length > 0 && (
        <div className={cn("flex gap-2", actions.length > 0 && "border-t border-border pt-3", stack ? "flex-col" : "flex-wrap")}>
          {secondaryActions.map((action) => renderButton(action, { secondary: true }))}
        </div>
      )}
      {pendingIsSecondary && panel}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
