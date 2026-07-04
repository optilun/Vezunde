import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

const input = "w-full border border-input rounded-md px-3 py-2 text-sm bg-card";
const MAX_CHARS = 60000;
export const CONFIRM_TEXT = "Confirm ca textul nu contine date despre pacienti, credentiale sau corespondenta privata.";

export default function AICopilotSourceForm({ onDone }) {
  const [mode, setMode] = useState("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
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
        source_type: mode === "url" ? "url" : "manual_text",
        source_url: url.trim(),
        manual_text: mode === "text" ? text : "",
        source_title: title,
        confirm_no_sensitive: mode === "text" ? confirmed : undefined,
      });
      onDone();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    }
    setSaving(false);
  };

  return (
    <div className="mt-4 border border-border rounded-lg p-4 bg-card">
      <div className="flex gap-2">
        {[["url", "URL public"], ["text", "Text manual"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${mode === k ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"}`}>{l}</button>
        ))}
      </div>

      <label className="block text-xs font-semibold text-muted-foreground mt-4 mb-1">Titlu sursa (optional)</label>
      <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />

      {mode === "url" ? (
        <>
          <label className="block text-xs font-semibold text-muted-foreground mt-3 mb-1">URL sursa (doar HTTPS public) *</label>
          <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          <p className="text-xs mt-2 border border-amber-400/50 bg-amber-50 rounded-md p-2 text-amber-900">
            Limitare de securitate (V1): preluarea automata a continutului de la URL-uri este dezactivata (protectie impotriva DNS rebinding). URL-ul este validat strict si pastrat doar ca atribuire — dupa salvare vei lipi manual textul relevant pentru analiza.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Sursele Google (Maps, Places, Search), adresele locale/private/interne, IP-urile literale si redirecturile sunt respinse.
          </p>
        </>
      ) : (
        <>
          <label className="block text-xs font-semibold text-muted-foreground mt-3 mb-1">URL de atribuire (optional, doar HTTPS public)</label>
          <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          <label className="block text-xs font-semibold text-muted-foreground mt-3 mb-1">Text sursa (lipit manual) *</label>
          <textarea className={input} rows={8} maxLength={MAX_CHARS} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">{text.length}/{MAX_CHARS} caractere (minim 40)</p>
          <p className="text-xs text-destructive mt-2 font-semibold">
            Nu lipi date despre pacienti, credentiale, corespondenta privata sau date personale sensibile. Tot continutul lipit este tratat ca sursa nesigura.
          </p>
          <label className="flex items-start gap-2 mt-3 text-xs">
            <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>{CONFIRM_TEXT}</span>
          </label>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <button onClick={submit} disabled={saving || (mode === "url" ? !url.trim() : text.trim().length < 40 || !confirmed)} className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
        {saving ? "Se salveaza..." : "Salveaza sursa"}
      </button>
    </div>
  );
}