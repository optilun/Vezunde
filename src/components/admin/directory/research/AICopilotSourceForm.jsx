import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

const input = "w-full border border-input rounded-md px-3 py-2 text-sm bg-card";
const MAX_CHARS = 60000;

export default function AICopilotSourceForm({ onDone }) {
  const [mode, setMode] = useState("url");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await base44.functions.invoke("aiResearchOps", {
        action: "extract_source",
        source_type: mode === "url" ? "url" : "manual_text",
        source_url: mode === "url" ? url.trim() : "",
        manual_text: mode === "text" ? text : "",
        source_title: title,
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
          <p className="text-xs text-muted-foreground mt-2">
            Se preia doar pagina indicata, fara linkuri, imagini sau scripturi. Sursele Google (Maps, Places, Search), adresele locale si redirecturile sunt respinse. Daca pagina nu poate fi preluata, poti adauga textul relevant manual.
          </p>
        </>
      ) : (
        <>
          <label className="block text-xs font-semibold text-muted-foreground mt-3 mb-1">Text sursa (lipit manual) *</label>
          <textarea className={input} rows={8} maxLength={MAX_CHARS} value={text} onChange={(e) => setText(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">{text.length}/{MAX_CHARS} caractere (minim 40)</p>
          <p className="text-xs text-destructive mt-2 font-semibold">
            Nu lipi date despre pacienti, credentiale, corespondenta privata sau date personale sensibile. Tot continutul lipit este tratat ca sursa nesigura.
          </p>
        </>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <button onClick={submit} disabled={saving || (mode === "url" ? !url.trim() : text.trim().length < 40)} className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40">
        {saving ? "Se salveaza..." : "Salveaza sursa"}
      </button>
    </div>
  );
}