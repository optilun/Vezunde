import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CONFIRM_TEXT } from "./AICopilotSourceForm";

// 3G.1.1: URL fetching is disabled (DNS rebinding protection), so URL sources
// need manual text pasted by the admin before analysis. Same server-side
// bounds + sensitive-data confirmation apply.
export default function AICopilotAttachText({ sourceId, onDone }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await base44.functions.invoke("aiResearchOps", {
        action: "extract_source",
        source_id: sourceId,
        manual_text: text,
        confirm_no_sensitive: confirmed,
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
      setSaving(false);
    }
  };

  if (!open) {
    return <button onClick={() => setOpen(true)} className="mt-2 px-3 py-1.5 rounded-md bg-secondary text-xs font-semibold">Adauga text manual pentru analiza</button>;
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <textarea className="w-full border border-input rounded-md px-3 py-2 text-sm bg-card" rows={6} maxLength={60000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Lipeste aici textul relevant de pe pagina sursei (minim 40 caractere)..." />
      <p className="text-xs text-destructive mt-1 font-semibold">Nu lipi date despre pacienti, credentiale sau corespondenta privata.</p>
      <label className="flex items-start gap-2 mt-2 text-xs">
        <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>{CONFIRM_TEXT}</span>
      </label>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button onClick={submit} disabled={saving || text.trim().length < 40 || !confirmed} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40">
          {saving ? "Se salveaza..." : "Salveaza textul"}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-md bg-secondary text-xs">Anuleaza</button>
      </div>
    </div>
  );
}