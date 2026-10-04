import React, { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { readableErrorMessage } from "@/lib/transientRetry";

// 2026-10-04 (structura conturilor, pasul 5). Butonul „Salvează” de pe paginile publice ale unei
// locații și ale unui specialist. Fără cont, duce la autentificare și salvează la întoarcere.

const PENDING_SAVE_KEY = "viasee:pending-save";

function readPendingSave() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_SAVE_KEY) || "null");
  } catch (_error) {
    return null;
  }
}

function writePendingSave(value) {
  try {
    if (value) sessionStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PENDING_SAVE_KEY);
  } catch (_error) {
    // Fără stocare temporară, persoana apasă din nou după autentificare.
  }
}

async function savedItemsOps(action, itemType, itemId) {
  const response = await base44.functions.invoke("mySavedItemsOps", { action, item_type: itemType, item_id: itemId });
  const data = response?.data || {};
  if (data.error) throw new Error(data.error);
  return data;
}

function errorText(error) {
  return readableErrorMessage(error?.response?.data?.error || error?.message, "Nu am putut actualiza „Salvate”. Încearcă din nou.");
}

export default function SaveToAccountButton({ itemType, itemId, label = "Salvează" }) {
  const { isAuthenticated, authChecked, navigateToLogin } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !itemId) return undefined;
    let active = true;
    const pending = readPendingSave();
    const savePending = pending?.item_type === itemType && pending?.item_id === itemId;
    if (savePending) writePendingSave(null);
    savedItemsOps(savePending ? "save" : "status", itemType, itemId)
      .then((data) => {
        if (!active) return;
        setSaved(data.saved === true);
        if (savePending && data.saved) setMessage("Salvat în contul tău, la „Salvate”.");
      })
      .catch((error) => {
        if (active && savePending) setMessage(errorText(error));
      });
    return () => { active = false; };
  }, [authChecked, isAuthenticated, itemType, itemId]);

  const toggle = async () => {
    if (busy || !itemId) return;
    setMessage("");
    if (!isAuthenticated) {
      writePendingSave({ item_type: itemType, item_id: itemId });
      void navigateToLogin(window.location.href);
      return;
    }
    setBusy(true);
    try {
      const data = await savedItemsOps(saved ? "remove" : "save", itemType, itemId);
      if (!mounted.current) return;
      setSaved(data.saved === true);
      setMessage(data.saved ? "Salvat în contul tău, la „Salvate”." : "Scos din „Salvate”.");
    } catch (error) {
      if (mounted.current) setMessage(errorText(error));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const Icon = busy ? Loader2 : saved ? BookmarkCheck : Bookmark;
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={saved}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${saved ? "border-foreground bg-foreground text-background hover:opacity-90" : "border-border bg-card hover:bg-secondary"}`}
      >
        <Icon className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
        {saved ? "Salvat" : label}
      </button>
      {message && <p role="status" className="max-w-[260px] text-right text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
