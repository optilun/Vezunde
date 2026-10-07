import React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Mesaj scurt în pagină (2026-10-07): eroare, reușită, avertisment sau informare, cu tokenii
// semantici. Înlocuiește casetele scrise de mână (`border-red-200 bg-red-50 …`). Erorile se anunță
// imediat (role="alert"), restul politicos (role="status").
const TONES = {
  danger: { box: "border-danger-border bg-danger-soft text-danger", icon: XCircle, role: "alert" },
  warning: { box: "border-warning-border bg-warning-soft text-warning", icon: AlertTriangle, role: "status" },
  success: { box: "border-success-border bg-success-soft text-success", icon: CheckCircle2, role: "status" },
  info: { box: "border-info-border bg-info-soft text-info", icon: Info, role: "status" },
};

export default function AdminNotice({ tone = "info", children, className = "", onDismiss, icon = true }) {
  const config = TONES[tone] || TONES.info;
  const Icon = config.icon;
  return (
    <div role={config.role} className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed", config.box, className)}>
      {icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Închide mesajul"
          className="-my-1 -mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
