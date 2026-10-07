import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Confirmare comună (2026-10-07): înlocuiește cele 10 `window.confirm` din panou (casete native,
// fără stil, fără focus corect). Folosire:
//   const confirm = useAdminConfirm();
//   if (!(await confirm({ title: "Anulezi campania?", description: "…", confirmLabel: "Anulează campania", tone: "danger" }))) return;
const ConfirmContext = createContext(null);

export function AdminConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const pending = useRef(null);
  const answer = useRef(false);

  const settle = useCallback((result) => {
    const current = pending.current;
    pending.current = null;
    answer.current = false;
    setRequest(null);
    current?.resolve(result);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    // O a doua întrebare o închide pe prima ca „nu”.
    pending.current?.resolve(false);
    const normalized = typeof options === "string" ? { title: options } : options || {};
    answer.current = false;
    pending.current = { resolve };
    setRequest(normalized);
  }), []);

  const danger = request?.tone === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={Boolean(request)} onOpenChange={(open) => { if (!open) settle(answer.current); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title || "Confirmi?"}</AlertDialogTitle>
            {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{request?.cancelLabel || "Anulează"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { answer.current = true; }}
              className={cn(danger && buttonVariants({ variant: "destructive" }))}
            >
              {request?.confirmLabel || "Confirmă"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

// În afara providerului (ex. teste) revine la caseta nativă, ca apelul să nu se piardă.
export function useAdminConfirm() {
  const confirm = useContext(ConfirmContext);
  if (confirm) return confirm;
  return async (options) => {
    const normalized = typeof options === "string" ? { title: options } : options || {};
    return window.confirm([normalized.title, normalized.description].filter(Boolean).join("\n\n"));
  };
}
