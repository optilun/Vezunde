// Faza 2: bara de actiuni (salvare, trimitere, retragere), extrasa 1:1.
import React from "react";
import { Save, Send, X } from "lucide-react";

export default function ServicesActionBar({ pendingReview, dirty, draft, saving, editable, persistenceMode, configurationComplete, blockerMessage, message, onSave, onSubmit, onWithdraw }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-1 rounded-[22px] border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className={`text-xs ${dirty ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{pendingReview ? "Modificări trimise spre aprobare" : dirty ? "Ai modificări nesalvate" : draft ? "Draft salvat" : "Nu există modificări nesalvate"}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={saving || !editable || !dirty} onClick={onSave} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><Save className="h-4 w-4" /> Salvează draftul</button>
          {draft && draft.status !== "pending_review" && <button type="button" disabled={saving || !editable || dirty || !configurationComplete} onClick={onSubmit} title={dirty ? "Salvează modificările înainte de trimitere" : blockerMessage || ""} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"><Send className="h-4 w-4" /> Trimite modificările spre aprobare</button>}
          {pendingReview && persistenceMode === "v2" && <button type="button" disabled={saving} onClick={onWithdraw} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><X className="h-4 w-4" /> Retrage cererea</button>}
        </div>
      </div>
      {!pendingReview && !dirty && !configurationComplete && <p className="mt-2 text-xs text-muted-foreground">{blockerMessage}</p>}
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}